import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  options: undefined as
    | {
        onCallback(
          error: Error | null,
          context: { returnTo?: string },
          session: null | { user: Record<string, unknown> },
        ): Promise<Response>
      }
    | undefined,
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
