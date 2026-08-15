import { Pool } from 'pg'
import { NextRequest, NextResponse } from 'next/server'

import { resolveCurrentGivingMemberIdentity, givingIdentityForMemberSubmission } from '@/auth/giving-member-identity'
import { createBlinkPayClient } from '@/lib/giving/blinkpay/client'
import { loadBlinkPayConfig } from '@/lib/giving/blinkpay/config'
import type { GivingContext } from '@/lib/giving/contracts'
import { createPayloadGivingE2ESessionStore, createGivingE2ESessionService, GIVING_E2E_COOKIE } from '@/lib/giving/e2e-session'
import { createGivingRockClient } from '@/lib/giving/rock-client'
import { createGivingIdentityRepository, resolveGivingIdentity } from '@/lib/giving/rock-identity'
import { createPostgresGivingRateLimitStore, enforceGivingRateLimits, GivingRateLimitError, trustedGivingClientAddress, type GivingRateLimitStore } from '@/lib/giving/rate-limit'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository, GivingCheckoutError, validateGivingCheckoutSubmission, type GivingCheckoutSubmission } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'
import { verifyTurnstileToken } from '@/lib/turnstile'

export const dynamic = 'force-dynamic'
export const GIVING_CHECKOUT_TURNSTILE_ACTION = 'giving-checkout'
const MAX_BODY_BYTES = 8_192
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

type Authority = GivingContext | null
export function productionGivingCheckoutAuthority(config: ReturnType<typeof loadBlinkPayConfig>): Authority {
  return config.environment === 'production' && config.productionEnabled && !config.readiness.some((item) => item.blocking)
    ? { contextKey: 'production', environment: 'production', synthetic: false, e2eRunId: null }
    : null
}
export interface GivingCheckoutRouteDependencies {
  authority(request: NextRequest): Promise<Authority>
  rateLimitStore: GivingRateLimitStore
  verifyTurnstile(input: { token: string; remoteIp: string; expectedHostname: string | null; expectedAction: string }): Promise<void>
  startCheckout(authority: GivingContext, submission: GivingCheckoutSubmission, request: NextRequest): Promise<{ gatewayRedirectUri: string; statusToken: string; correlationKey: string; reused: boolean }>
}

function response(value: unknown, status: number, retryAfter?: number) {
  return NextResponse.json(value, {
    status,
    headers: { ...PRIVATE_HEADERS, ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) },
  })
}
function trustedMutation(request: NextRequest) {
  if (request.headers.get('origin') !== 'https://www.ev.church') return false
  if (request.headers.get('sec-fetch-site') !== 'same-origin') return false
  return request.headers.get('x-ev-giving-request') === 'checkout-v1'
}
function isJson(request: NextRequest) {
  return request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
}
async function boundedJson(request: NextRequest) {
  const declared = request.headers.get('content-length')
  if (declared && (!Number.isSafeInteger(Number(declared)) || Number(declared) < 0 || Number(declared) > MAX_BODY_BYTES)) {
    throw new GivingCheckoutError('invalid')
  }
  if (!request.body) throw new GivingCheckoutError('invalid')
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new GivingCheckoutError('invalid')
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new GivingCheckoutError('invalid')
  }
}
function poolFromPayload(payload: Awaited<ReturnType<typeof getPayloadClient>>) {
  return (payload.db as unknown as { pool?: Pool }).pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
}

async function defaultAuthority(request: NextRequest): Promise<Authority> {
  const payload = await getPayloadClient()
  const token = request.cookies.get(GIVING_E2E_COOKIE)?.value
  const e2e = await createGivingE2ESessionService(createPayloadGivingE2ESessionStore(payload)).read(token)
  if (e2e) return e2e
  if (process.env.BLINKPAY_PRODUCTION_ENABLED !== 'true') return null
  try { return productionGivingCheckoutAuthority(loadBlinkPayConfig('production')) } catch { return null }
}

async function defaultStart(authority: GivingContext, submission: GivingCheckoutSubmission, _request: NextRequest) {
  const payload = await getPayloadClient()
  const pool = poolFromPayload(payload)
  const rock = createGivingRockClient()
  const member = await resolveCurrentGivingMemberIdentity({ rockClient: rock })
  const identityRepository = createGivingIdentityRepository(pool)
  const config = loadBlinkPayConfig(authority.environment)
  if (authority.environment === 'production' && config.readiness.some((item) => item.blocking)) {
    throw new GivingCheckoutError('unavailable')
  }
  const service = createGivingCheckoutService({
    repository: createPostgresGivingCheckoutRepository(pool),
    blinkPay: createBlinkPayClient({ config }),
    digestSecret: process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? '',
    resolveIdentity(input) {
      const identity = member.signedIn
        ? givingIdentityForMemberSubmission(member, {
            firstName: submission.firstName, lastName: submission.lastName, email: submission.email,
          })
        : input.identity
      return resolveGivingIdentity({ ...input, identity }, {
        rockClient: rock,
        repository: identityRepository,
        fingerprintSecret: process.env.GIVING_IDENTITY_FINGERPRINT_SECRET ?? '',
        syntheticPersonAliasId: authority.synthetic ? Number(process.env.GIVING_ROCK_E2E_PERSON_ALIAS_ID) : undefined,
      })
    },
  })
  return service.start({ ...authority, submission })
}

const defaults: GivingCheckoutRouteDependencies = {
  authority: defaultAuthority,
  rateLimitStore: {
    async increment(input) {
      const payload = await getPayloadClient()
      return createPostgresGivingRateLimitStore(poolFromPayload(payload)).increment(input)
    },
  },
  verifyTurnstile: verifyTurnstileToken,
  startCheckout: defaultStart,
}

export async function handleGivingCheckoutPost(request: NextRequest, dependencies: GivingCheckoutRouteDependencies = defaults) {
  try {
    const authority = await dependencies.authority(request)
    if (!authority) return response({ error: 'Giving unavailable' }, 404)
    if (!trustedMutation(request)) return response({ error: 'Giving unavailable' }, 403)
    if (!isJson(request)) return response({ error: 'Giving unavailable' }, 415)
    const submission = validateGivingCheckoutSubmission(await boundedJson(request))
    const address = trustedGivingClientAddress(request.headers)
    await enforceGivingRateLimits({ address, email: submission.email, store: dependencies.rateLimitStore })
    await dependencies.verifyTurnstile({ token: submission.turnstileToken, remoteIp: address, expectedHostname: process.env.NODE_ENV === 'production' ? 'www.ev.church' : null, expectedAction: GIVING_CHECKOUT_TURNSTILE_ACTION })
    const result = await dependencies.startCheckout(authority, submission, request)
    const output = response({ gatewayRedirectUri: result.gatewayRedirectUri, correlationKey: result.correlationKey, reused: result.reused }, 201)
    output.cookies.set('__Host-ev_giving_checkout', result.statusToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 30 * 60 })
    return output
  } catch (error) {
    if (error instanceof GivingRateLimitError) return response({ error: 'Giving unavailable' }, 429, error.retryAfterSeconds)
    if (error instanceof GivingCheckoutError && error.code === 'invalid') return response({ error: 'Giving unavailable' }, 400)
    return response({ error: 'Giving unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) { return handleGivingCheckoutPost(request) }
