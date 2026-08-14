import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { readAuth0Config } from '@/auth/auth0-config'
import { startMemberImpersonation } from '@/auth/member-impersonation'
import { isCurrentPayloadAdmin } from '@/auth/payload-admin-session'
import { findRockAuth0MemberByPersonId } from '@/auth/rock-member-directory'
import { isTrustedAuthRequest } from '@/auth/trusted-auth-request'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' }

function notFound() {
  return new NextResponse('Not found', { status: 404, headers: PRIVATE_HEADERS })
}

export async function POST(request: NextRequest) {
  if (!isTrustedAuthRequest(request.headers)) return notFound()

  try {
    const isAdmin = await isCurrentPayloadAdmin(request.headers)
    if (!isAdmin) return notFound()

    const auth0 = getAuth0Client()
    const session = await auth0.getSession(request)
    if (!session) return notFound()

    const formData = await request.formData()

    const rawPersonId = formData.get('personId')
    if (typeof rawPersonId !== 'string' || !/^\d+$/u.test(rawPersonId)) {
      return notFound()
    }
    const personId = Number(rawPersonId)
    if (!Number.isSafeInteger(personId) || personId <= 0) return notFound()

    const target = await findRockAuth0MemberByPersonId(personId)
    if (!target.ok) return notFound()
    const updatedSession = startMemberImpersonation(session, target.profile)
    if (!updatedSession) return notFound()

    const response = NextResponse.redirect(
      new URL('/members', readAuth0Config().appBaseUrl),
      303,
    )
    await auth0.updateSession(request, response, updatedSession)
    response.headers.set('Cache-Control', PRIVATE_HEADERS['Cache-Control'])
    return response
  } catch {
    return notFound()
  }
}
