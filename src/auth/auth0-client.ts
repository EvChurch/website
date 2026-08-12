import { Auth0Client } from '@auth0/nextjs-auth0/server'
import { NextResponse } from 'next/server'

import { hasPayloadAdminRole } from '@/access/roles'
import { identityFromSessionUser } from './auth0-identity'
import { readAuth0Config } from './auth0-config'
import {
  createResolvedMemberMarker,
  createUnresolvedMemberMarker,
} from './member-session'
import { resolveRockMemberProfile } from './rock-member-profile'
import { safeAdminReturnTo } from './safe-admin-return'
import { safeMemberReturnTo } from './safe-member-return'

let cached: Auth0Client | undefined

function logCallbackFailure(reason: 'invalid_callback' | 'provisioning_failed') {
  console.error({ event: 'auth0_admin_callback_failed', reason })
}

function isPublicMemberReturnTo(value: unknown) {
  return typeof value === 'string' && safeMemberReturnTo(value) === value
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
      rolling: false,
      absoluteDuration: 72 * 60 * 60,
      cookie: {
        name: secure ? '__Host-ev_admin_session' : 'ev_admin_session',
        path: '/',
        sameSite: 'lax',
        secure,
      },
    },
    beforeSessionSaved: async (session) => {
      try {
        const resolution = await resolveRockMemberProfile(session.user.sub)
        return {
          ...session,
          rockProfile: resolution.ok
            ? createResolvedMemberMarker(resolution.profile)
            : createUnresolvedMemberMarker(),
        }
      } catch {
        console.warn('Member profile resolution did not complete', {
          reason: 'unexpected-resolution-error',
        })
        return {
          ...session,
          rockProfile: createUnresolvedMemberMarker(),
        }
      }
    },
    onCallback: async (error, context, session) => {
      const adminCallback = !isPublicMemberReturnTo(context.returnTo)

      if (!adminCallback) {
        if (error || !session) {
          return NextResponse.redirect(
            new URL('/member-sign-in/error', config.appBaseUrl),
          )
        }

        const completeUrl = new URL('/member-auth/complete', config.appBaseUrl)
        completeUrl.searchParams.set(
          'returnTo',
          safeMemberReturnTo(context.returnTo),
        )
        return NextResponse.redirect(completeUrl)
      }

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
