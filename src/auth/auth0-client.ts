import { Auth0Client } from '@auth0/nextjs-auth0/server'
import { NextResponse } from 'next/server'

import { hasPayloadAdminRole } from '@/access/roles'
import { identityFromSessionUser } from './auth0-identity'
import { readAuth0Config } from './auth0-config'
import { safeAdminReturnTo } from './safe-admin-return'

let cached: Auth0Client | undefined

function logCallbackFailure(reason: 'invalid_callback' | 'provisioning_failed') {
  console.error({ event: 'auth0_admin_callback_failed', reason })
}

export function getAuth0Client() {
  if (cached) return cached
  const config = readAuth0Config()
  const secure = config.appBaseUrl.startsWith('https://')

  cached = new Auth0Client({
    appBaseUrl: config.appBaseUrl,
    domain: config.domain,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    secret: config.secret,
    authorizationParameters: { scope: 'openid profile email' },
    enableAccessTokenEndpoint: false,
    logoutStrategy: 'oidc',
    signInReturnToPath: '/admin',
    session: {
      rolling: true,
      absoluteDuration: 8 * 60 * 60,
      inactivityDuration: 2 * 60 * 60,
      cookie: {
        name: secure ? '__Host-ev_admin_session' : 'ev_admin_session',
        path: '/',
        sameSite: 'lax',
        secure,
      },
    },
    onCallback: async (error, context, session) => {
      const errorUrl = new URL('/auth/error', config.appBaseUrl)
      if (error || !session) {
        logCallbackFailure('invalid_callback')
        return NextResponse.redirect(errorUrl)
      }

      const identity = identityFromSessionUser(config.issuer, session.user)
      if (!identity) {
        logCallbackFailure('invalid_callback')
        return NextResponse.redirect(errorUrl)
      }

      try {
        const [{ getPayloadClient }, { provisionAuth0User }] = await Promise.all([
          import('@/lib/payload'),
          import('./provision-auth0-user'),
        ])
        const payload = await getPayloadClient()
        const user = await provisionAuth0User(payload, identity)
        const returnTo = safeAdminReturnTo(context.returnTo)
        if (!hasPayloadAdminRole(user)) {
          const pending = new URL('/auth/pending', config.appBaseUrl)
          pending.searchParams.set('returnTo', returnTo)
          return NextResponse.redirect(pending)
        }
        return NextResponse.redirect(new URL(returnTo, config.appBaseUrl))
      } catch {
        logCallbackFailure('provisioning_failed')
        return NextResponse.redirect(errorUrl)
      }
    },
  })
  return cached
}
