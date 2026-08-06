import { NextRequest, NextResponse } from 'next/server'

import { getCurrentMemberProfile } from '@/auth/member-session'
import { safeMemberReturnTo } from '@/auth/safe-member-return'

export const dynamic = 'force-dynamic'

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentMemberProfile()

  if (!profile) {
    const logoutUrl = new URL('/member-auth/logout', request.nextUrl.origin)
    logoutUrl.searchParams.set('returnTo', '/member-sign-in/error')
    return privateRedirect(logoutUrl)
  }

  const returnTo = safeMemberReturnTo(
    request.nextUrl.searchParams.get('returnTo'),
  )
  return privateRedirect(new URL(returnTo, request.nextUrl.origin))
}
