import { NextRequest, NextResponse } from 'next/server'

import { givingIdentityForMemberSubmission, resolveCurrentGivingMemberIdentity } from '@/auth/giving-member-identity'
import type { GivingBankTransferPreparation } from '@/lib/giving/bank-transfer'
import { GIVING_REQUEST_MARKERS } from '@/lib/giving/contracts'
import { createPostgresGivingRateLimitStore, enforceGivingRateLimits, GivingRateLimitError, trustedGivingClientAddress, type GivingRateLimitStore } from '@/lib/giving/rate-limit'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { boundedGivingJson, GIVING_PRIVATE_HEADERS, InvalidGivingRequestError, isGivingJson, trustedGivingMutation } from '@/lib/giving/request-boundary'
import { createGivingRockClient } from '@/lib/giving/rock-client'
import { createGivingIdentityRepository, resolveGivingIdentity } from '@/lib/giving/rock-identity'
import { createPostgresGivingCheckoutRepository, GivingCheckoutError, prepareGivingBankTransfer, validateGivingCheckoutSubmission, type GivingCheckoutSubmission } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'
import { verifyTurnstileToken } from '@/lib/turnstile'

export const dynamic = 'force-dynamic'
const TURNSTILE_ACTION = 'giving-checkout'

export interface GivingBankTransferRouteDependencies {
  rateLimitStore: GivingRateLimitStore
  verifyTurnstile(input: { token: string; remoteIp: string; expectedHostname: string | null; expectedAction: string }): Promise<void>
  prepare(submission: GivingCheckoutSubmission, request: NextRequest): Promise<GivingBankTransferPreparation>
}

function response(value: unknown, status: number, retryAfter?: number) {
  return NextResponse.json(value, {
    status,
    headers: { ...GIVING_PRIVATE_HEADERS, ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) },
  })
}

async function defaultPrepare(submission: GivingCheckoutSubmission) {
  const payload = await getPayloadClient()
  const pool = requireGivingPostgresPool(payload)
  const rock = createGivingRockClient()
  const member = await resolveCurrentGivingMemberIdentity({ rockClient: rock })
  return prepareGivingBankTransfer({
    contextKey: 'production',
    environment: 'production',
    synthetic: false,
    submission,
  }, {
    repository: createPostgresGivingCheckoutRepository(pool),
    digestSecret: process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? '',
    resolveIdentity(input) {
      const identity = member.signedIn
        ? givingIdentityForMemberSubmission(member, {
            firstName: submission.firstName,
            lastName: submission.lastName,
            email: submission.email,
          })
        : input.identity
      return resolveGivingIdentity({ ...input, identity }, {
        rockClient: rock,
        repository: createGivingIdentityRepository(pool),
        fingerprintSecret: process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? '',
      })
    },
  })
}

const defaults: GivingBankTransferRouteDependencies = {
  rateLimitStore: {
    async increment(input) {
      const payload = await getPayloadClient()
      return createPostgresGivingRateLimitStore(requireGivingPostgresPool(payload)).increment(input)
    },
  },
  verifyTurnstile: verifyTurnstileToken,
  prepare: defaultPrepare,
}

export async function handleGivingBankTransferPost(request: NextRequest, dependencies: GivingBankTransferRouteDependencies = defaults) {
  try {
    if (!trustedGivingMutation(request, GIVING_REQUEST_MARKERS.bankTransfer)) return response({ error: 'Giving unavailable' }, 403)
    if (!isGivingJson(request)) return response({ error: 'Giving unavailable' }, 415)
    const submission = validateGivingCheckoutSubmission(await boundedGivingJson(request))
    const address = trustedGivingClientAddress(request.headers)
    await enforceGivingRateLimits({ address, email: submission.email, store: dependencies.rateLimitStore })
    await dependencies.verifyTurnstile({
      token: submission.turnstileToken,
      remoteIp: address,
      expectedHostname: process.env.NODE_ENV === 'production' ? 'www.ev.church' : null,
      expectedAction: TURNSTILE_ACTION,
    })
    return response(await dependencies.prepare(submission, request), 200)
  } catch (error) {
    if (error instanceof GivingRateLimitError) return response({ error: 'Giving unavailable' }, 429, error.retryAfterSeconds)
    if (error instanceof InvalidGivingRequestError || error instanceof GivingCheckoutError && error.code === 'invalid') return response({ error: 'Giving unavailable' }, 400)
    return response({ error: 'Giving unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) {
  return handleGivingBankTransferPost(request)
}
