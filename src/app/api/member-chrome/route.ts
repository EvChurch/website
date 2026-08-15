import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { isCurrentPayloadAdmin } from '@/auth/payload-admin-session'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Cookie',
}

const ANONYMOUS_CHROME = {
  memberProfile: null,
  memberCampusSlug: null,
  adminHref: null,
  impersonation: null,
} as const

function anonymousResponse() {
  return NextResponse.json(ANONYMOUS_CHROME, { headers: PRIVATE_HEADERS })
}

function hasSubject(session: unknown): session is { user: { sub: string } } {
  if (typeof session !== 'object' || session === null) return false
  const user = (session as { user?: unknown }).user
  return typeof user === 'object' && user !== null &&
    typeof (user as { sub?: unknown }).sub === 'string' &&
    Boolean((user as { sub: string }).sub)
}

export async function GET(request: NextRequest) {
  const hasSessionCookie = request.cookies.has('__Host-ev_admin_session') ||
    request.cookies.has('ev_admin_session')
  if (!hasSessionCookie) return anonymousResponse()

  try {
    const session = await getAuth0Client().getSession()
    if (!hasSubject(session)) return anonymousResponse()

    const profileState = getMemberProfileStateFromSession(session)
    const impersonation = getMemberImpersonationFromSession(session)
    const payloadAdmin = await isCurrentPayloadAdmin(request.headers)

    return NextResponse.json({
      memberProfile: profileState
        ? {
            name: profileState.profile.name,
            email: profileState.profile.email,
            avatarUrl:
              profileState.profile.photoUrl || profileState.needsRefresh
                ? '/member-avatar'
                : null,
          }
        : null,
      memberCampusSlug: profileState?.profile.campusSlug ?? null,
      adminHref: payloadAdmin ? '/admin/impersonate' : null,
      impersonation,
    }, { headers: PRIVATE_HEADERS })
  } catch {
    return anonymousResponse()
  }
}
