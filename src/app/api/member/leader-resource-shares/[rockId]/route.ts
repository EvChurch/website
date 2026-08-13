import { NextRequest, NextResponse } from 'next/server'
import { createOrReuseLeaderResourceShare } from '@/lib/members/leader-resource-sharing'
import { isSameOriginRequest } from '@/lib/request-origin'

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

export async function POST(request: NextRequest, { params }: { params: Promise<{ rockId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers })
  const { rockId } = await params
  const token = await createOrReuseLeaderResourceShare(Number(rockId))
  return token
    ? NextResponse.json({ path: `/shared/leader-resources/${token}` }, { headers })
    : NextResponse.json({ error: 'Not found' }, { status: 404, headers })
}
