import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const middleware = vi.fn()
const getSession = vi.fn()

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ middleware }),
}))
vi.mock('@/auth/auth0-session', () => ({
  getAuth0SessionFromHeaders: (...args: unknown[]) => getSession(...args),
}))
vi.mock('@/auth/auth0-config', () => ({
  readAuth0Config: () => ({ appBaseUrl: 'https://www.ev.church' }),
}))

import { config, proxy } from './proxy'

describe('admin Auth0 proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    middleware.mockResolvedValue(NextResponse.next())
  })

  it('runs Auth0 middleware for admin API activity so rolling sessions stay active', () => {
    expect(config.matcher).toContain('/api/:path*')
  })

  it('redirects a signed-out nested admin request to Auth0', async () => {
    getSession.mockResolvedValue(null)
    const response = await proxy(
      new NextRequest('https://www.ev.church/admin/collections/pages?limit=10'),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/auth/login?returnTo=%2Fadmin%2Fcollections%2Fpages%3Flimit%3D10',
    )
  })

  it('preserves the SDK response for an authenticated request', async () => {
    getSession.mockResolvedValue({ subject: 'auth0|123' })
    const response = await proxy(new NextRequest('https://www.ev.church/admin'))
    expect(response.status).toBe(200)
    expect(middleware).toHaveBeenCalledOnce()
  })

  it('does not guard public routes', async () => {
    const response = await proxy(new NextRequest('https://www.ev.church/events'))
    expect(response.status).toBe(200)
    expect(getSession).not.toHaveBeenCalled()
  })

  it('returns a private 503 when an Auth0 route cannot run', async () => {
    middleware.mockRejectedValue(new Error('configuration unavailable'))
    const response = await proxy(
      new NextRequest('https://www.ev.church/auth/login?returnTo=/admin'),
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
  })
})
