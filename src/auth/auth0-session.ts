import { NextRequest } from 'next/server'

import { identityFromSessionUser, type Auth0Identity } from './auth0-identity'
import { getAuth0Client } from './auth0-client'
import { readAuth0Config } from './auth0-config'
import { isTrustedAuthRequest } from './trusted-auth-request'

export async function getAuth0SessionFromHeaders(
  headers: Headers,
): Promise<Auth0Identity | null> {
  try {
    if (!isTrustedAuthRequest(headers)) return null
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
