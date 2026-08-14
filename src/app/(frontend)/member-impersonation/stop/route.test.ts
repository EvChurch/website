import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  updated: null as null | Record<string, unknown>,
}))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({
    getSession: vi.fn(async () => state.session),
    updateSession: vi.fn(async (session) => { state.updated = session }),
  }),
}))
vi.mock('@/auth/auth0-config', () => ({
  readAuth0Config: () => ({ appBaseUrl: 'https://www.ev.church' }),
}))

import { startMemberImpersonation } from '@/auth/member-impersonation'
import { POST } from './route'

describe('stop member impersonation route', () => {
  beforeEach(() => {
    state.session = startMemberImpersonation(
      { user: { sub: 'auth0|admin' } } as never,
      {
        personId: 42,
        name: 'Alex Member',
        email: 'alex@example.com',
        photoUrl: null,
      },
    )
    state.updated = null
  })

  it('returns to the real account without requiring the admin role again', async () => {
    const response = await POST(new NextRequest(
      'https://www.ev.church/member-impersonation/stop',
      { method: 'POST', headers: { origin: 'https://www.ev.church' } },
    ))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://www.ev.church/')
    expect(state.updated?.user).toEqual({ sub: 'auth0|admin' })
    expect(state.updated?.memberImpersonation).toBeUndefined()
  })

  it('rejects cross-site, absent, and non-impersonating sessions', async () => {
    const crossSite = await POST(new NextRequest(
      'https://www.ev.church/member-impersonation/stop',
      { method: 'POST', headers: { origin: 'https://evil.example' } },
    ))
    state.session = { user: { sub: 'auth0|admin' } }
    const inactive = await POST(new NextRequest(
      'https://www.ev.church/member-impersonation/stop',
      { method: 'POST', headers: { origin: 'https://www.ev.church' } },
    ))
    state.session = null
    const absent = await POST(new NextRequest(
      'https://www.ev.church/member-impersonation/stop',
      { method: 'POST', headers: { origin: 'https://www.ev.church' } },
    ))

    expect([crossSite.status, inactive.status, absent.status]).toEqual([404, 404, 404])
    expect(state.updated).toBeNull()
  })
})
