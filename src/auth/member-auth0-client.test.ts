import { describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import type { SessionData } from '@auth0/nextjs-auth0/types'

const state = vi.hoisted(() => ({
  options: undefined as Record<string, unknown> | undefined,
  resolution: {
    ok: true as boolean,
    profile: {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: '/GetImage.ashx?id=42',
    },
  },
  rejectResolution: false,
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
      appBaseUrl: 'https://www.ev.church/',
      clientId: 'member-client',
      clientSecret: 'member-secret',
      domain: 'members.au.auth0.com',
      secret: 'b'.repeat(64),
    },
    rock: {
      apiKey: 'member-rock-key',
      apiUrl: 'https://rock.ev.church/api',
    },
  }),
}))
vi.mock('./rock-member-profile', () => ({
  resolveRockMemberProfile: vi.fn(async () => {
    if (state.rejectResolution) throw new Error('Rock unavailable')
    return state.resolution.ok
      ? { ok: true, profile: state.resolution.profile }
      : { ok: false, reason: 'identity-not-found' }
  }),
}))

import { getMemberAuth0Client } from './member-auth0-client'

function session(subject = 'auth0|member-42'): SessionData {
  return {
    user: { sub: subject },
    tokenSet: { accessToken: 'not-persisted-by-test', expiresAt: 1 },
    internal: { sid: 'sid', createdAt: 1 },
  }
}

function hook<T>(name: string) {
  const value = state.options?.[name]
  if (typeof value !== 'function') throw new Error(`Missing ${name}`)
  return value as T
}

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

  it('persists a minimal resolved marker before the SDK saves the session', async () => {
    getMemberAuth0Client()
    state.resolution.ok = true
    state.rejectResolution = false

    const beforeSessionSaved = hook<
      (value: SessionData, idToken: string | null) => Promise<SessionData>
    >('beforeSessionSaved')
    const result = await beforeSessionSaved(session(), null)

    expect(result.rockProfile).toEqual({
      version: 1,
      status: 'resolved',
      profile: state.resolution.profile,
    })
  })

  it.each([
    ['an unresolved identity', false, false],
    ['an unexpected resolver exception', true, true],
  ])('stores no usable identity for %s', async (_label, ok, rejects) => {
    getMemberAuth0Client()
    state.resolution.ok = ok
    state.rejectResolution = rejects

    const beforeSessionSaved = hook<
      (value: SessionData, idToken: string | null) => Promise<SessionData>
    >('beforeSessionSaved')
    const result = await beforeSessionSaved(session(), null)

    expect(result.rockProfile).toEqual({ version: 1, status: 'unresolved' })
  })

  it('routes a successful callback through completion with a safe return path', async () => {
    getMemberAuth0Client()
    const onCallback = hook<
      (
        error: Error | null,
        context: { returnTo?: string },
        value: SessionData | null,
      ) => Promise<NextResponse>
    >('onCallback')

    const response = await onCallback(
      null,
      { returnTo: '/events?campus=2' },
      session(),
    )

    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/member-auth/complete?returnTo=%2Fevents%3Fcampus%3D2',
    )
  })

  it('fails OAuth errors and hostile callback returns closed', async () => {
    getMemberAuth0Client()
    const onCallback = hook<
      (
        error: Error | null,
        context: { returnTo?: string },
        value: SessionData | null,
      ) => Promise<NextResponse>
    >('onCallback')

    const oauthFailure = await onCallback(
      new Error('access_denied'),
      { returnTo: '/events' },
      null,
    )
    const hostileReturn = await onCallback(
      null,
      { returnTo: '//evil.example/steal' },
      session(),
    )

    expect(oauthFailure.headers.get('location')).toBe(
      'https://www.ev.church/member-auth/logout?returnTo=https%3A%2F%2Fwww.ev.church%2Fmember-sign-in%2Ferror',
    )
    expect(hostileReturn.headers.get('location')).toBe(
      'https://www.ev.church/member-auth/complete?returnTo=%2F',
    )
  })
})
