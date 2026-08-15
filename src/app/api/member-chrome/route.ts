import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { isCurrentPayloadAdmin } from '@/auth/payload-admin-session'
import { ANONYMOUS_MEMBER_CHROME, type MemberChromeState } from '@/lib/member-chrome'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Cookie',
}

function anonymousResponse() {
  return NextResponse.json(ANONYMOUS_MEMBER_CHROME, { headers: PRIVATE_HEADERS })
}

export async function GET(request: NextRequest) {
  const hasSessionCookie = request.cookies.has('__Host-ev_admin_session') ||
    request.cookies.has('ev_admin_session')
  if (!hasSessionCookie) return anonymousResponse()

  try {
    const session = await getAuth0Client().getSession(request)
    if (!session?.user.sub) return anonymousResponse()

    const profileState = getMemberProfileStateFromSession(session)
    const impersonation = getMemberImpersonationFromSession(session)
    const payloadAdmin = await isCurrentPayloadAdmin(request.headers)

    const state = {
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
    } satisfies MemberChromeState

    return NextResponse.json(state, { headers: PRIVATE_HEADERS })
  } catch {
    return anonymousResponse()
  }
}
