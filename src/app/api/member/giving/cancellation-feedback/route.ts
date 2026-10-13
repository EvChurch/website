import { NextRequest, NextResponse } from 'next/server'

import { isSameOriginRequest } from '@/lib/request-origin'
import { parseCancellationFeedback, saveMemberCancellationFeedback } from '@/lib/members/giving'
import { MEMBER_GIVING_PRIVATE_HEADERS, requireMemberGivingActor } from '../auth'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 1_024

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: MEMBER_GIVING_PRIVATE_HEADERS,
  })
}

export async function POST(request: NextRequest) {
  if (
    !isSameOriginRequest(request) ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
  ) return json({ status: 'invalid-request' }, 400)
  const actor = await requireMemberGivingActor(request)
  if (!actor) return json({ status: 'auth-required' }, 401)
  try {
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return json({ status: 'invalid-request' }, 400)
    }
    const feedback = parseCancellationFeedback(JSON.parse(body))
    if (!feedback) return json({ status: 'invalid-request' }, 400)
    const saved = await saveMemberCancellationFeedback(actor, feedback)
    return saved ? json({ status: 'saved' }) : json({ status: 'not-found' }, 404)
  } catch {
    return json({ status: 'unavailable' }, 503)
  }
}
