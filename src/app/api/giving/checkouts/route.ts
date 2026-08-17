import { NextRequest, NextResponse } from 'next/server'

import { resolveCurrentGivingMemberIdentity, givingIdentityForMemberSubmission } from '@/auth/giving-member-identity'
import { getBlinkPayRuntimeClient } from '@/lib/giving/blinkpay/runtime-client'
import { loadBlinkPayConfig } from '@/lib/giving/blinkpay/config'
import { GIVING_REQUEST_MARKERS, type GivingContext } from '@/lib/giving/contracts'
import { createGivingRockClient } from '@/lib/giving/rock-client'
import { createGivingIdentityRepository, resolveGivingIdentity } from '@/lib/giving/rock-identity'
import { createPostgresGivingRateLimitStore, enforceGivingRateLimits, GivingRateLimitError, trustedGivingClientAddress, type GivingRateLimitStore } from '@/lib/giving/rate-limit'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { boundedGivingJson, GIVING_PRIVATE_HEADERS, InvalidGivingRequestError, isGivingJson, trustedGivingMutation } from '@/lib/giving/request-boundary'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository, GivingCheckoutError, validateGivingCheckoutSubmission, type GivingCheckoutStartResult, type GivingCheckoutSubmission } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'
import { verifyTurnstileToken } from '@/lib/turnstile'

export const dynamic = 'force-dynamic'
export const GIVING_CHECKOUT_TURNSTILE_ACTION = 'giving-checkout'

type Authority = GivingContext | null
export function productionGivingCheckoutAuthority(config: ReturnType<typeof loadBlinkPayConfig>): Authority {
  return config.environment === 'production'
    ? { contextKey: 'production', environment: 'production', synthetic: false }
    : null
}
export interface GivingCheckoutRouteDependencies {
  authority(request: NextRequest): Promise<Authority>
  rateLimitStore: GivingRateLimitStore
  verifyTurnstile(input: { token: string; remoteIp: string; expectedHostname: string | null; expectedAction: string }): Promise<void>
  startCheckout(authority: GivingContext, submission: GivingCheckoutSubmission, request: NextRequest): Promise<GivingCheckoutStartResult>
}

function response(value: unknown, status: number, retryAfter?: number) {
  return NextResponse.json(value, {
    status,
    headers: { ...GIVING_PRIVATE_HEADERS, ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) },
  })
}
async function defaultAuthority(_request: NextRequest): Promise<Authority> {
  return resolveGivingCheckoutAuthority({
    loadProduction: () => loadBlinkPayConfig('production'),
  })
}

export async function resolveGivingCheckoutAuthority(input: {
  loadProduction(): ReturnType<typeof loadBlinkPayConfig>
}): Promise<Authority> {
  try { return productionGivingCheckoutAuthority(input.loadProduction()) } catch { return null }
}

async function defaultStart(authority: GivingContext, submission: GivingCheckoutSubmission, _request: NextRequest) {
  const payload = await getPayloadClient()
  const pool = requireGivingPostgresPool(payload)
  const rock = createGivingRockClient()
  const member = await resolveCurrentGivingMemberIdentity({ rockClient: rock })
  const identityRepository = createGivingIdentityRepository(pool)
  const service = createGivingCheckoutService({
    repository: createPostgresGivingCheckoutRepository(pool),
    blinkPay: getBlinkPayRuntimeClient(authority.environment),
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
      return createPostgresGivingRateLimitStore(requireGivingPostgresPool(payload)).increment(input)
    },
  },
  verifyTurnstile: verifyTurnstileToken,
  startCheckout: defaultStart,
}

export async function handleGivingCheckoutPost(request: NextRequest, dependencies: GivingCheckoutRouteDependencies = defaults) {
  try {
    const authority = await dependencies.authority(request)
    if (!authority) return response({ error: 'Giving unavailable' }, 404)
    if (!trustedGivingMutation(request, GIVING_REQUEST_MARKERS.checkout)) return response({ error: 'Giving unavailable' }, 403)
    if (!isGivingJson(request)) return response({ error: 'Giving unavailable' }, 415)
    const submission = validateGivingCheckoutSubmission(await boundedGivingJson(request))
    const address = trustedGivingClientAddress(request.headers)
    await enforceGivingRateLimits({ address, email: submission.email, store: dependencies.rateLimitStore })
    await dependencies.verifyTurnstile({ token: submission.turnstileToken, remoteIp: address, expectedHostname: process.env.NODE_ENV === 'production' ? 'www.ev.church' : null, expectedAction: GIVING_CHECKOUT_TURNSTILE_ACTION })
    const result = await dependencies.startCheckout(authority, submission, request)
    const output = result.outcome === 'redirect'
      ? response({ outcome: result.outcome, gatewayRedirectUri: result.gatewayRedirectUri, correlationKey: result.correlationKey, reused: result.reused }, 201)
      : response({ outcome: result.outcome, retryAllowed: result.retryAllowed, correlationKey: result.correlationKey, reused: result.reused }, 202)
    output.cookies.set('__Host-ev_giving_checkout', result.statusToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 30 * 60 })
    return output
  } catch (error) {
    if (error instanceof GivingRateLimitError) return response({ error: 'Giving unavailable' }, 429, error.retryAfterSeconds)
    if (error instanceof InvalidGivingRequestError || error instanceof GivingCheckoutError && error.code === 'invalid') return response({ error: 'Giving unavailable' }, 400)
    return response({ error: 'Giving unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) { return handleGivingCheckoutPost(request) }
