import { NextRequest } from 'next/server'

import { identityFromSessionUser, type Auth0Identity } from './auth0-identity'
import { getAuth0Client } from './auth0-client'
import { readAuth0Config } from './auth0-config'
import { isTrustedAuthRequest } from './trusted-auth-request'

export async function getAuth0SessionFromHeaders(
  headers: Headers,
): Promise<Auth0Identity | null> {
  try {
    // Auth0 redirects retain same-site/cross-site Fetch Metadata through the
    // final admin navigation. Browser POSTs carry Origin; only allow an
    // originless top-level document navigation to read its verified session.
    const isDocumentNavigation = !headers.has('origin') &&
      headers.get('sec-fetch-mode') === 'navigate' &&
      headers.get('sec-fetch-dest') === 'document'
    if (!isDocumentNavigation && !isTrustedAuthRequest(headers)) return null
    const config = readAuth0Config()
    const request = new NextRequest(new URL('/auth/session-check', config.appBaseUrl), {
      headers,
    })
    const session = await getAuth0Client().getSession(request)
    if (!session) return null
    return identityFromSessionUser(config.issuer, session.user)
  } catch {
    return null
  }
}
