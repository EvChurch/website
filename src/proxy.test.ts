import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const middleware = vi.fn()
const getSession = vi.fn()
const findRedirect = vi.fn()

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ middleware }),
}))
vi.mock('@/auth/auth0-session', () => ({
  getAuth0SessionFromHeaders: (...args: unknown[]) => getSession(...args),
}))
vi.mock('@/auth/auth0-config', () => ({
  readAuth0Config: () => ({ appBaseUrl: 'https://www.ev.church' }),
}))
vi.mock('@/lib/missing-paths', () => ({
  findMissingPathRedirect: (...args: unknown[]) => findRedirect(...args),
}))

import { config, proxy } from './proxy'

describe('admin Auth0 proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    middleware.mockResolvedValue(NextResponse.next())
    findRedirect.mockResolvedValue(null)
  })

  it('runs Auth0 middleware for admin API activity so rolling sessions stay active', () => {
    expect(config.matcher).toHaveLength(1)
    expect(config.matcher[0]).not.toContain('(?!api')
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
    expect(middleware).not.toHaveBeenCalled()
    expect(findRedirect).toHaveBeenCalledWith('/events')
    expect(response.headers.get('x-middleware-request-x-ev-public-path')).toBe('/events')
  })

  it('redirects slash and query variants immediately', async () => {
    findRedirect.mockResolvedValue('/kids')
    const response = await proxy(
      new NextRequest('https://www.ev.church/old/?utm_source=ahrefs'),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://www.ev.church/kids')
    expect(findRedirect).toHaveBeenCalledWith('/old')
  })

  it.each([
    '/members/missing',
    '/_next/static/chunk.js',
    '/robots.txt',
    '/favicon.ico',
    '/images/logo.svg',
  ])('does not query or attach a public path for excluded request %s', async (pathname) => {
    const request = new NextRequest(`https://www.ev.church${pathname}`, {
      headers: { 'x-ev-public-path': '/spoofed' },
    })
    const response = await proxy(request)
    expect(findRedirect).not.toHaveBeenCalled()
    expect(response.headers.get('x-middleware-override-headers')).not.toBeNull()
    expect(response.headers.get('x-middleware-override-headers')).not.toContain(
      'x-ev-public-path',
    )
    expect(response.headers.get('x-middleware-request-x-ev-public-path')).toBeNull()
  })

  it('overwrites a spoofed public path header on eligible requests', async () => {
    const response = await proxy(new NextRequest('https://www.ev.church/real/', {
      headers: { 'x-ev-public-path': '/spoofed' },
    }))
    expect(response.headers.get('x-middleware-request-x-ev-public-path')).toBe('/real')
  })

  it('dispatches Auth0 routes to the shared Auth0 client', async () => {
    getSession.mockResolvedValue(null)
    await proxy(new NextRequest('https://www.ev.church/auth/login'))
    expect(middleware).toHaveBeenCalledOnce()
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
