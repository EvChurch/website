import { NextRequest, NextResponse } from 'next/server'

import { getPayloadClient } from '@/lib/payload'
import { listPublicRockForms } from '@/lib/rock-forms/server'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
}

function notFound() {
  return NextResponse.json(
    { error: 'Not found' },
    { status: 404, headers: PRIVATE_HEADERS },
  )
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayloadClient()
    const { user, permissions } = await payload.auth({ headers: request.headers })
    if (!user || permissions.collections?.pages?.update !== true) {
      return notFound()
    }
  } catch {
    return notFound()
  }

  try {
    return NextResponse.json(
      { forms: await listPublicRockForms() },
      { headers: PRIVATE_HEADERS },
    )
  } catch {
    return NextResponse.json(
      { error: 'Unable to load Rock forms' },
      { status: 502, headers: PRIVATE_HEADERS },
    )
  }
}
