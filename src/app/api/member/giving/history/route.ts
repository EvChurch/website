import { NextRequest, NextResponse } from 'next/server'

import { getMemberGiftHistoryPage } from '@/lib/members/giving'
import { MEMBER_GIVING_PRIVATE_HEADERS, requireMemberGivingActor } from '../auth'

export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: MEMBER_GIVING_PRIVATE_HEADERS,
  })
}

export async function GET(request: NextRequest) {
  const actor = await requireMemberGivingActor(request)
  if (!actor) return json({ status: 'auth-required' }, 401)
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1')
  if (!Number.isSafeInteger(page) || page <= 0) return json({ status: 'invalid-request' }, 400)
  try {
    return json(await getMemberGiftHistoryPage(actor, page))
  } catch {
    return json({ status: 'unavailable' }, 503)
  }
}
