import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ error: 'Sermons are now managed in Payload. Church Resources import has been retired.' }, { status: 410 })
}
