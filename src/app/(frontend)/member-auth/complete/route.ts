import { NextRequest } from 'next/server'

import {
  memberSignInErrorUrl,
  privateMemberRedirect,
} from '@/auth/member-auth-response'
import { getCurrentMemberProfile } from '@/auth/member-session'
import { safeMemberReturnTo } from '@/auth/safe-member-return'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const profile = await getCurrentMemberProfile()

  if (!profile) {
    return privateMemberRedirect(memberSignInErrorUrl(request.nextUrl.origin))
  }

  const returnTo = safeMemberReturnTo(
    request.nextUrl.searchParams.get('returnTo'),
  )
  return privateMemberRedirect(new URL(returnTo, request.nextUrl.origin))
}
