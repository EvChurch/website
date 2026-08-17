import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  options: undefined as
    | {
      beforeSessionSaved(
        session: { user: Record<string, unknown> },
      ): Promise<Record<string, unknown>>
        session: {
          absoluteDuration: number
          rolling: boolean
        }
        onCallback(
          error: Error | null,
          context: { returnTo?: string },
          session: null | { user: Record<string, unknown> },
        ): Promise<Response>
      }
    | undefined,
  resolution: {
    ok: true,
    profile: {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: null,
      campusSlug: 'central',
    },
  },
  rejectResolution: false,
}))
const provisionAuth0User = vi.hoisted(() => vi.fn())

vi.mock('@auth0/nextjs-auth0/server', () => ({
  Auth0Client: class {
    middleware = vi.fn()

    constructor(options: typeof state.options) {
      state.options = options
    }
  },
}))
vi.mock('./auth0-config', () => ({
  readAuth0Config: () => ({
    appBaseUrl: 'https://www.ev.church',
    clientId: 'client',
    clientSecret: 'secret',
    domain: 'login.ev.church',
    issuer: 'https://login.ev.church/',
    secret: 'a'.repeat(64),
  }),
}))
vi.mock('@/lib/payload', () => ({ getPayloadClient: () => ({}) }))
vi.mock('./provision-auth0-user', () => ({ provisionAuth0User }))
vi.mock('./rock-member-profile', () => ({
  resolveRockMemberProfile: vi.fn(async () => {
    if (state.rejectResolution) throw new Error('Rock unavailable')
    return state.resolution
  }),
}))

import { getAuth0Client } from './auth0-client'

const verifiedSession = {
  user: {
    sub: 'auth0|123',
    email: 'person@example.com',
    email_verified: true,
    name: 'Person',
  },
}

function callback() {
  getAuth0Client()
  if (!state.options) throw new Error('Auth0 callback was not configured')
  return state.options.onCallback
}

describe('Auth0 callback', () => {
  beforeEach(() => {
    provisionAuth0User.mockReset()
    state.resolution.ok = true
    state.rejectResolution = false
  })

  it('uses a fixed 72-hour session without rolling expiry', () => {
    getAuth0Client()

    expect(state.options!.session).toEqual(
      expect.objectContaining({
        absoluteDuration: 72 * 60 * 60,
        rolling: false,
      }),
    )
    expect(state.options!.session).not.toHaveProperty('inactivityDuration')
  })

  it('stores the resolved Rock profile in the shared Auth0 session', async () => {
    getAuth0Client()
    const result = await state.options!.beforeSessionSaved(verifiedSession)

    expect(result.rockProfile).toEqual({
      version: 3,
      status: 'resolved',
      profile: state.resolution.profile,
    })
  })

  it.each([
    ['an unresolved Rock identity', false],
    ['a Rock resolution failure', true],
  ])('keeps the shared session fail-closed for %s', async (_label, rejects) => {
    getAuth0Client()
    state.resolution.ok = false
    state.rejectResolution = rejects

    const result = await state.options!.beforeSessionSaved(verifiedSession)

    expect(result.rockProfile).toEqual({ version: 3, status: 'unresolved' })
  })

  it('completes public sign-in without provisioning Payload access', async () => {
    const response = await callback()(
      null,
      { returnTo: '/events?campus=2' },
      verifiedSession,
    )

    expect(provisionAuth0User).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/member-auth/complete?returnTo=%2Fevents%3Fcampus%3D2',
    )
  })

  it('preserves the local giving capability path through the Auth0 callback', async () => {
    const response = await callback()(
      null,
      { returnTo: '/give/resume/abcdefghijklmnopqrstuvwxyz0123456789_ABCDEF' },
      verifiedSession,
    )

    expect(provisionAuth0User).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/member-auth/complete?returnTo=%2Fgive%2Fresume%2Fabcdefghijklmnopqrstuvwxyz0123456789_ABCDEF',
    )
  })

  it('does not route malformed giving returns through admin provisioning', async () => {
    const response = await callback()(null, { returnTo: '/give/return/not-a-resume' }, verifiedSession)
    expect(provisionAuth0User).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/member-auth/complete?returnTo=%2F',
    )
  })

  it.each([
    ['an SDK error', new Error('callback failed'), verifiedSession],
    ['a missing session', null, null],
  ])('fails public sign-in closed for %s', async (_label, error, session) => {
    const response = await callback()(error, { returnTo: '/events' }, session)

    expect(provisionAuth0User).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/member-sign-in/error',
    )
  })

  it.each([
    ['SDK error', new Error('callback failed'), verifiedSession],
    ['missing session', null, null],
    [
      'unverified email',
      null,
      { user: { ...verifiedSession.user, email_verified: false } },
    ],
  ])('redirects an invalid %s without provisioning', async (_label, error, session) => {
    const response = await callback()(error, { returnTo: '/admin' }, session)
    expect(response.headers.get('location')).toBe('https://www.ev.church/auth/error')
    expect(provisionAuth0User).not.toHaveBeenCalled()
  })

  it('provisions a roleless user and redirects to pending access', async () => {
    provisionAuth0User.mockResolvedValue({ roles: [] })
    const response = await callback()(null, { returnTo: '/admin/pages' }, verifiedSession)
    expect(provisionAuth0User).toHaveBeenCalledOnce()
    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/auth/pending?returnTo=%2Fadmin%2Fpages',
    )
  })

  it('redirects an authorized user only to a safe admin path', async () => {
    provisionAuth0User.mockResolvedValue({ roles: ['editor'] })
    const response = await callback()(
      null,
      { returnTo: 'https://attacker.example/steal' },
      verifiedSession,
    )
    expect(response.headers.get('location')).toBe('https://www.ev.church/admin')
  })

  it('redirects provisioning failures without exposing details', async () => {
    provisionAuth0User.mockRejectedValue(new Error('database detail'))
    const response = await callback()(null, { returnTo: '/admin' }, verifiedSession)
    expect(response.headers.get('location')).toBe('https://www.ev.church/auth/error')
  })
})
