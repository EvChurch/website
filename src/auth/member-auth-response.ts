import { NextResponse } from 'next/server'

export function privateMemberRedirect(url: URL) {
  const response = NextResponse.redirect(url)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export function memberSignInErrorUrl(appBaseUrl: string) {
  return new URL('/member-sign-in/error', appBaseUrl)
}
