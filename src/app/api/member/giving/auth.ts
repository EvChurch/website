import type { NextRequest } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { resolveMemberGivingActor, type MemberGivingActor } from '@/lib/members/giving'

export const MEMBER_GIVING_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Cookie',
}

const SESSION_COOKIE_NAMES = ['__Host-ev_admin_session', 'ev_admin_session'] as const

export function hasMemberSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    SESSION_COOKIE_NAMES.some((sessionName) =>
      name === sessionName || name.startsWith(`${sessionName}__`),
    ),
  )
}

export async function requireMemberGivingActor(request: NextRequest): Promise<MemberGivingActor | null> {
  if (!hasMemberSessionCookie(request)) return null
  try {
    const session = await getAuth0Client().getSession(request)
    if (!session?.user.sub) return null
    if (getMemberImpersonationFromSession(session)) return null
    const profileState = getMemberProfileStateFromSession(session)
    if (!profileState || profileState.profile.personId <= 0) return null
    return await resolveMemberGivingActor(session.user.sub)
  } catch {
    return null
  }
}
