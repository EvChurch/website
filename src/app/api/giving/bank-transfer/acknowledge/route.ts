import { NextRequest, NextResponse } from 'next/server'

import { GIVING_REQUEST_MARKERS, isGivingCapabilityToken } from '@/lib/giving/contracts'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { boundedGivingJson, GIVING_PRIVATE_HEADERS, InvalidGivingRequestError, isGivingJson, trustedGivingMutation } from '@/lib/giving/request-boundary'
import { acknowledgeGivingBankSetup, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export interface GivingBankAcknowledgementDependencies {
  acknowledge(token: string): Promise<boolean>
}

const defaults: GivingBankAcknowledgementDependencies = {
  async acknowledge(token) {
    const payload = await getPayloadClient()
    return acknowledgeGivingBankSetup(token, { repository: createPostgresGivingCheckoutRepository(requireGivingPostgresPool(payload)) })
  },
}

function response(value: unknown, status: number) {
  return NextResponse.json(value, { status, headers: GIVING_PRIVATE_HEADERS })
}

export async function handleGivingBankAcknowledgementPost(request: NextRequest, dependencies: GivingBankAcknowledgementDependencies = defaults) {
  try {
    if (!trustedGivingMutation(request, GIVING_REQUEST_MARKERS.bankTransferAcknowledgement)) return response({ error: 'Giving unavailable' }, 403)
    if (!isGivingJson(request)) return response({ error: 'Giving unavailable' }, 415)
    const value = await boundedGivingJson(request)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return response({ error: 'Giving unavailable' }, 400)
    const item = value as Record<string, unknown>
    if (Object.keys(item).join(',') !== 'token' || !isGivingCapabilityToken(item.token)) {
      return response({ error: 'Giving unavailable' }, 400)
    }
    return await dependencies.acknowledge(item.token)
      ? response({ acknowledged: true, verified: false }, 200)
      : response({ error: 'Giving unavailable' }, 404)
  } catch (error) {
    if (error instanceof InvalidGivingRequestError) return response({ error: 'Giving unavailable' }, 400)
    return response({ error: 'Giving unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) {
  return handleGivingBankAcknowledgementPost(request)
}
