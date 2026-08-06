import { Auth0Client } from '@auth0/nextjs-auth0/server'
import { NextResponse } from 'next/server'

import { readMemberAuthConfiguration } from './member-auth0-config'
import {
  createResolvedMemberMarker,
  createUnresolvedMemberMarker,
} from './member-session'
import { resolveRockMemberProfile } from './rock-member-profile'
import { safeMemberReturnTo } from './safe-member-return'

let cached: Auth0Client | undefined

export function getMemberAuth0Client() {
  if (cached) return cached

  const { auth0: config } = readMemberAuthConfiguration()
  const secure = config.appBaseUrl.startsWith('https://')
  const cookiePrefix = secure ? '__Host-' : ''

  cached = new Auth0Client({
    appBaseUrl: config.appBaseUrl,
    domain: config.domain,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    secret: config.secret,
    authorizationParameters: { scope: 'openid profile email' },
    enableAccessTokenEndpoint: false,
    logoutStrategy: 'oidc',
    signInReturnToPath: '/',
    routes: {
      login: '/member-auth/login',
      logout: '/member-auth/logout',
      callback: '/member-auth/callback',
      backChannelLogout: '/member-auth/backchannel-logout',
      profile: '/member-auth/profile',
      accessToken: '/member-auth/access-token',
    },
    session: {
      rolling: false,
      absoluteDuration: 8 * 60 * 60,
      cookie: {
        name: `${cookiePrefix}ev_member_session`,
        path: '/',
        sameSite: 'lax',
        secure,
      },
    },
    transactionCookie: {
      prefix: `${cookiePrefix}ev_member_txn_`,
      path: '/',
      sameSite: 'lax',
      secure,
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
      if (error || !session) {
        console.warn('Member authentication callback did not complete', {
          reason: 'invalid-callback',
        })
        const logoutUrl = new URL('/member-auth/logout', config.appBaseUrl)
        logoutUrl.searchParams.set('returnTo', '/member-sign-in/error')
        return privateRedirect(logoutUrl)
      }

      const completeUrl = new URL('/member-auth/complete', config.appBaseUrl)
      completeUrl.searchParams.set(
        'returnTo',
        safeMemberReturnTo(context.returnTo),
      )
      return privateRedirect(completeUrl)
    },
  })

  return cached
}

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
