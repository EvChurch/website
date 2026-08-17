import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { handleGivingStatusGet } from './route'

describe('giving checkout status', () => {
  it('returns only minimal status through the strict cookie capability', async () => {
    const read = vi.fn(async () => ({ state: 'unknown' as const, retryAllowed: false, kind: 'one-off' as const }))
    const response = await handleGivingStatusGet(
      new NextRequest('https://www.ev.church/api/giving/checkouts/current/status', { headers: { cookie: `__Host-ev_giving_checkout=${'A'.repeat(43)}` } }),
      { params: Promise.resolve({ token: 'current' }) },
      { read },
    )
    expect(await response.json()).toEqual({ state: 'unknown', retryAllowed: false, kind: 'one-off' })
    expect(read).toHaveBeenCalledWith('A'.repeat(43))
    expect(response.headers.get('cache-control')).toContain('private')
  })

  it.each(['verified','cancelled','rejected','expired'] as const)('clears the status cookie after terminal %s', async (state) => {
    const response = await handleGivingStatusGet(
      new NextRequest('https://www.ev.church/api/giving/checkouts/current/status', { headers: { cookie: `__Host-ev_giving_checkout=${'A'.repeat(43)}` } }),
      { params: Promise.resolve({ token: 'current' }) },
      { read: vi.fn(async () => ({ state, retryAllowed: state !== 'verified', kind: 'one-off' as const })) },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_checkout=')
    expect(response.headers.get('set-cookie')?.toLowerCase()).toContain('max-age=0')
  })

  it('fails closed when the service returns a malformed browser contract', async () => {
    const read = vi.fn(async () => ({ state: 'verified', retryAllowed: false, kind: 'one-off', providerId: 'secret' } as never))
    const response = await handleGivingStatusGet(
      new NextRequest('https://www.ev.church/api/giving/checkouts/current/status', { headers: { cookie: `__Host-ev_giving_checkout=${'A'.repeat(43)}` } }),
      { params: Promise.resolve({ token: 'current' }) },
      { read },
    )
    expect(response.status).toBe(404)
  })

  it('does not treat a predictable path or missing cookie as authority', async () => {
    const read = vi.fn()
    for (const [token, cookie] of [['42', ''], ['current', '']]) {
      const response = await handleGivingStatusGet(
        new NextRequest(`https://www.ev.church/api/giving/checkouts/${token}/status`, { headers: cookie ? { cookie } : {} }),
        { params: Promise.resolve({ token }) },
        { read },
      )
      expect(response.status).toBe(404)
    }
    expect(read).not.toHaveBeenCalled()
  })
})
