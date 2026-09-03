import { NextRequest, NextResponse } from 'next/server'

import { getBlinkPayRuntimeClient } from '@/lib/giving/blinkpay/runtime-client'
import { createGivingCancellationService, createPostgresGivingCancellationStore } from '@/lib/giving/cancellation'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { getPayloadClient } from '@/lib/payload'
import { isSameOriginRequest } from '@/lib/request-origin'
import { memberCancellationAuditReason } from '@/lib/members/giving'
import { MEMBER_GIVING_PRIVATE_HEADERS, requireMemberGivingActor } from '../../../auth'

export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: MEMBER_GIVING_PRIVATE_HEADERS,
  })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return json({ status: 'invalid-request' }, 400)
  const actor = await requireMemberGivingActor(request)
  if (!actor) return json({ status: 'auth-required' }, 401)

  const { id } = await context.params
  const scheduleId = Number(id)
  if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0) {
    return json({ status: 'invalid-request' }, 400)
  }

  try {
    const payload = await getPayloadClient()
    const service = createGivingCancellationService({
      store: createPostgresGivingCancellationStore(requireGivingPostgresPool(payload)),
      provider: getBlinkPayRuntimeClient,
    })
    const result = await service.cancelImmediate({
      actor: { kind: 'member', ...actor },
      scheduleId,
      reason: memberCancellationAuditReason(),
    })
    if (result.status === 'cancelled') return json(result, 200)
    if (result.status === 'unknown') return json(result, 202)
    return json({ status: 'not-cancelled' }, 409)
  } catch {
    return json({ status: 'unavailable' }, 503)
  }
}
