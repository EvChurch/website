import { NextRequest, NextResponse } from 'next/server'

import { getPayloadClient } from '@/lib/payload'
import { listEligibleRockConnectionSignups } from '@/lib/rock-connection-signups/server'
import { trackNotFound } from '@/lib/tracked-not-found'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
}

function notFound() {
  trackNotFound('api', 'admin', 'rock-connection-signups')
  return NextResponse.json(
    { error: 'Not found' },
    { status: 404, headers: PRIVATE_HEADERS },
  )
}

export async function GET(request: NextRequest) {
  let canEditPages = false
  try {
    const payload = await getPayloadClient()
    const { user, permissions } = await payload.auth({
      headers: request.headers,
    })
    canEditPages = Boolean(
      user && permissions.collections?.pages?.update === true,
    )
  } catch {
    return notFound()
  }

  if (!canEditPages) return notFound()

  try {
    const configurations = await listEligibleRockConnectionSignups()
    return NextResponse.json(
      { configurations },
      { headers: PRIVATE_HEADERS },
    )
  } catch {
    return NextResponse.json(
      { error: 'Unable to load Rock connection signup configurations' },
      { status: 502, headers: PRIVATE_HEADERS },
    )
  }
}
