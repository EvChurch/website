import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  answers: {
    amountMinor: 5000, fundId: 2, frequency: 'monthly', startDate: '2026-09-01',
    firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com', returnPathname: '/events',
  },
}))

vi.mock('@/auth/auth0-client', () => ({ getAuth0Client: () => ({ getSession: async () => null }) }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({}) }))
vi.mock('@/lib/giving/drafts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/giving/drafts')>()
  return {
    ...original,
    createPayloadGivingDraftStore: () => ({}),
    createGivingDraftService: () => ({
      redeem: async () => state.answers,
      createSession: async () => ({ token: 'session-cookie-token' }),
    }),
  }
})

import { GET } from './route'

describe('giving draft resume route', () => {
  beforeEach(() => vi.stubEnv('NODE_ENV', 'production'))

  it('exchanges the URL capability for a secure host cookie and the original clean pathname', async () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789_ABCDEF'
    const request = new NextRequest(`https://www.ev.church/give/resume/${token}`, {
      headers: { cookie: '__Host-ev_giving_guest=guest-nonce' },
    })
    const response = await GET(request, { params: Promise.resolve({ token }) })

    expect(response.headers.get('location')).toBe('https://www.ev.church/events')
    expect(response.headers.get('location')).not.toContain(token)
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_resume=session-cookie-token')
    expect(response.headers.get('set-cookie')).toContain('Secure')
    expect(response.headers.get('set-cookie')?.toLowerCase()).toContain('samesite=strict')
  })
})
