import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  options: undefined as Record<string, unknown> | undefined,
}))

vi.mock('@auth0/nextjs-auth0/server', () => ({
  Auth0Client: class {
    constructor(options: Record<string, unknown>) {
      state.options = options
    }
  },
}))
vi.mock('./member-auth0-config', () => ({
  readMemberAuthConfiguration: () => ({
    auth0: {
      appBaseUrl: 'https://www.ev.church',
      clientId: 'member-client',
      clientSecret: 'member-secret',
      domain: 'members.au.auth0.com',
      issuer: 'https://members.au.auth0.com/',
      secret: 'b'.repeat(64),
    },
    rock: {
      apiKey: 'member-rock-key',
      apiUrl: 'https://rock.ev.church/api',
    },
  }),
}))

import { getMemberAuth0Client } from './member-auth0-client'

describe('member Auth0 client', () => {
  it('uses isolated routes, cookies, transactions, and a fixed session lifetime', () => {
    getMemberAuth0Client()

    expect(state.options).toMatchObject({
      clientId: 'member-client',
      enableAccessTokenEndpoint: false,
      logoutStrategy: 'oidc',
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
          name: '__Host-ev_member_session',
          path: '/',
          sameSite: 'lax',
          secure: true,
        },
      },
      transactionCookie: {
        prefix: '__Host-ev_member_txn_',
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    })
  })
})
