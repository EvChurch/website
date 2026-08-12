import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getAuth0SessionFromHeaders } from '@/auth/auth0-session'
import { readAuth0Config } from '@/auth/auth0-config'
import { safeAdminReturnTo } from '@/auth/safe-admin-return'
import { findMissingPathRedirect } from '@/lib/missing-paths'
import {
  encodePublicPathHeader,
  isEligiblePublicPath,
  matchesPathPrefix,
  normalizePublicPath,
  PUBLIC_PATH_HEADER,
} from '@/lib/public-paths'

export async function proxy(request: NextRequest) {
  const isAdminAuthRoute = matchesPathPrefix(request.nextUrl.pathname, '/auth')
  const isAdminRoute = matchesPathPrefix(request.nextUrl.pathname, '/admin')
  const isAdminApiRoute = matchesPathPrefix(request.nextUrl.pathname, '/api')
  const normalizedPath = normalizePublicPath(request.nextUrl.pathname)
  const isEligiblePath = normalizedPath !== null && isEligiblePublicPath(normalizedPath)

  if (
    !isAdminAuthRoute &&
    !isAdminRoute &&
    !isAdminApiRoute
  ) {
    if (!isEligiblePath) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.delete(PUBLIC_PATH_HEADER)
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
    let destination: string | null = null
    try {
      destination = await findMissingPathRedirect(normalizedPath)
    } catch {
      console.error({
        category: 'missing-path-redirect-lookup-failed',
        path: normalizedPath,
      })
    }
    if (destination) return NextResponse.redirect(new URL(destination, request.url))

    const requestHeaders = new Headers(request.headers)
    const encodedPath = encodePublicPathHeader(normalizedPath)
    if (encodedPath) requestHeaders.set(PUBLIC_PATH_HEADER, encodedPath)
    return NextResponse.next({ request: { headers: requestHeaders } })
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
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest).*)',
  ],
}
