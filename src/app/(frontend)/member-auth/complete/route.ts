import { NextRequest } from 'next/server'

import {
  memberSignInErrorUrl,
  privateMemberRedirect,
} from '@/auth/member-auth-response'
import { readMemberAuth0Config } from '@/auth/member-auth0-config'
import { getCurrentMemberProfile } from '@/auth/member-session'
import { safeMemberReturnTo } from '@/auth/safe-member-return'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const profile = await getCurrentMemberProfile()

  if (!profile) {
    const { appBaseUrl } = readMemberAuth0Config()
    const logoutUrl = new URL('/member-auth/logout', appBaseUrl)
    logoutUrl.searchParams.set('returnTo', memberSignInErrorUrl(appBaseUrl))
    return privateMemberRedirect(logoutUrl)
  }

  const returnTo = safeMemberReturnTo(
    request.nextUrl.searchParams.get('returnTo'),
  )
  return privateMemberRedirect(new URL(returnTo, request.nextUrl.origin))
}
