import { Auth0Client } from '@auth0/nextjs-auth0/server'

import { readMemberAuthConfiguration } from './member-auth0-config'

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
  })

  return cached
}
