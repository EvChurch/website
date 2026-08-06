import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getAuth0SessionFromHeaders } from '@/auth/auth0-session'
import { readAuth0Config } from '@/auth/auth0-config'
import { safeAdminReturnTo } from '@/auth/safe-admin-return'

export async function proxy(request: NextRequest) {
  const isAdminAuthRoute =
    request.nextUrl.pathname === '/auth' ||
    request.nextUrl.pathname.startsWith('/auth/')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isAdminApiRoute = request.nextUrl.pathname.startsWith('/api')

  if (
    !isAdminAuthRoute &&
    !isAdminRoute &&
    !isAdminApiRoute
  ) {
    return NextResponse.next()
  }

  let response: NextResponse
  try {
    response = await getAuth0Client().middleware(request)
  } catch {
    if (isAdminRoute || isAdminAuthRoute) {
      return new NextResponse('Authentication is temporarily unavailable.', {
        status: 503,
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      })
    }
    return NextResponse.next()
  }

  if (!isAdminRoute) return response

  const identity = await getAuth0SessionFromHeaders(request.headers)
  if (identity) return response

  const config = readAuth0Config()
  const login = new URL('/auth/login', config.appBaseUrl)
  login.searchParams.set(
    'returnTo',
    safeAdminReturnTo(`${request.nextUrl.pathname}${request.nextUrl.search}`),
  )
  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    '/auth/:path*',
    '/admin/:path*',
    '/api/:path*',
  ],
}
