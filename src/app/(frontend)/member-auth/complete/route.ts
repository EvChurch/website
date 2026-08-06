import { NextRequest } from 'next/server'

import {
  memberSignInErrorUrl,
  privateMemberRedirect,
} from '@/auth/member-auth-response'
import { readAuth0Config } from '@/auth/auth0-config'
import { getCurrentMemberProfile } from '@/auth/member-session'
import { safeMemberReturnTo } from '@/auth/safe-member-return'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { appBaseUrl } = readAuth0Config()
  const profile = await getCurrentMemberProfile()

  if (!profile) {
    return privateMemberRedirect(memberSignInErrorUrl(appBaseUrl))
  }

  const returnTo = safeMemberReturnTo(
    request.nextUrl.searchParams.get('returnTo'),
  )
  return privateMemberRedirect(new URL(returnTo, appBaseUrl))
}
