import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.hoisted(() => vi.fn())
vi.mock('./auth0-client', () => ({
  getAuth0Client: () => ({
    getSession,
    middleware: async () => NextResponse.next(),
  }),
}))
vi.mock('./auth0-config', () => ({
  readAuth0Config: () => ({
    appBaseUrl: 'https://www.ev.church',
    issuer: 'https://tenant.au.auth0.com/',
  }),
}))
vi.mock('@/lib/missing-paths', () => ({ findMissingPathRedirect: vi.fn() }))

import { proxy } from '@/proxy'
import { getAuth0SessionFromHeaders } from './auth0-session'

const navigation = {
  'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'document',
}

describe('admin session after Auth0 redirect', () => {
  beforeEach(() => {
    getSession.mockReset()
    getSession.mockResolvedValue({
      user: { sub: 'auth0|123', email: 'person@example.com', email_verified: true },
    })
  })

  it.each(['same-site', 'cross-site'])('does not restart sign-in after a %s callback navigation', async (site) => {
    const response = await proxy(new NextRequest('https://www.ev.church/admin/sermon-manager', {
      headers: { ...navigation, 'sec-fetch-site': site },
    }))

    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
    expect(getSession).toHaveBeenCalledOnce()
  })

  it('still redirects an unsigned callback navigation to sign-in', async () => {
    getSession.mockResolvedValue(null)
    const response = await proxy(new NextRequest('https://www.ev.church/admin', {
      headers: { ...navigation, 'sec-fetch-site': 'cross-site' },
    }))
    expect(response.headers.get('location')).toContain('/auth/login')
  })

  it.each([
    { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' },
    { ...navigation, 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
    { ...navigation, 'sec-fetch-site': 'cross-site', origin: 'null' },
    { ...navigation, 'sec-fetch-site': 'same-site', origin: 'https://login.ev.church' },
    { ...navigation, 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'iframe' },
  ])('rejects untrusted requests before reading the session: %j', async (headers) => {
    expect(await getAuth0SessionFromHeaders(new Headers(headers))).toBeNull()
    expect(getSession).not.toHaveBeenCalled()
  })
})
