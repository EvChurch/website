import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  admin: true,
  session: null as null | Record<string, unknown>,
  target: null as null | Record<string, unknown>,
  updated: null as null | Record<string, unknown>,
}))

vi.mock('@/auth/member-impersonation', async () => {
  const actual = await vi.importActual<typeof import('@/auth/member-impersonation')>(
    '@/auth/member-impersonation',
  )
  return { ...actual }
})
vi.mock('@/auth/rock-member-directory', () => ({
  findRockAuth0MemberByPersonId: vi.fn(async () => state.target
    ? { ok: true, profile: state.target }
    : { ok: false, reason: 'identity-not-found' }),
}))
vi.mock('@/auth/payload-admin-session', () => ({
  isCurrentPayloadAdmin: vi.fn(async () => state.admin),
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

import { POST } from './route'

function request(personId = '42', headers: HeadersInit = {}) {
  const body = new FormData()
  body.set('personId', personId)
  return new NextRequest('https://www.ev.church/member-impersonation/start', {
    method: 'POST',
    headers: { origin: 'https://www.ev.church', ...headers },
    body,
  })
}

describe('start member impersonation route', () => {
  beforeEach(() => {
    state.admin = true
    state.session = { user: { sub: 'auth0|admin' } }
    state.target = {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: null,
    }
    state.updated = null
  })

  it('starts impersonation for an exact Payload admin', async () => {
    const response = await POST(request())

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://www.ev.church/members')
    expect(state.updated?.user).toEqual({ sub: 'auth0|admin' })
    expect(state.updated?.memberImpersonation).toBeDefined()
  })

  it.each([
    ['non-admin', () => { state.admin = false }],
    ['missing session', () => { state.session = null }],
    ['invalid target', () => { state.target = null }],
  ])('fails closed for %s', async (_label, setup) => {
    setup()
    const response = await POST(request())
    expect(response.status).toBe(404)
    expect(state.updated).toBeNull()
  })

  it('rejects cross-site and malformed requests', async () => {
    const crossSite = await POST(request('42', { origin: 'https://evil.example' }))
    const malformed = await POST(request('not-a-number'))
    expect(crossSite.status).toBe(404)
    expect(malformed.status).toBe(404)
    expect(state.updated).toBeNull()
  })
})
