import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { readAuth0Config } from '@/auth/auth0-config'
import { stopMemberImpersonation } from '@/auth/member-impersonation'
import { isTrustedAuthRequest } from '@/auth/trusted-auth-request'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' }

function notFound() {
  return new NextResponse('Not found', { status: 404, headers: PRIVATE_HEADERS })
}

export async function POST(request: NextRequest) {
  if (!isTrustedAuthRequest(request.headers)) return notFound()

  try {
    const auth0 = getAuth0Client()
    const session = await auth0.getSession(request)
    if (!session) return notFound()
    const updatedSession = stopMemberImpersonation(session)
    if (!updatedSession) return notFound()

    await auth0.updateSession(updatedSession)
    const response = NextResponse.redirect(
      new URL('/', readAuth0Config().appBaseUrl),
      303,
    )
    response.headers.set('Cache-Control', PRIVATE_HEADERS['Cache-Control'])
    return response
  } catch {
    return notFound()
  }
}
