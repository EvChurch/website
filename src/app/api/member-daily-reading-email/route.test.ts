import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), subscribe: vi.fn() }))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ getSession: mocks.getSession }),
}))
vi.mock('@/lib/daily-readings/email-subscription', () => ({
  subscribeDailyReadingEmail: mocks.subscribe,
}))

import { POST } from './route'

function request(origin = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/member-daily-reading-email', {
    method: 'POST',
    headers: { origin },
  })
}

describe('member Daily Bible Reading email signup route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({
      user: { sub: 'auth0|member' },
      rockProfile: {
        version: 3,
        status: 'resolved',
        profile: {
          personId: 42,
          name: 'Aroha Ngata',
          email: 'aroha@example.com',
          photoUrl: null,
          campusSlug: 'central',
        },
      },
    })
    mocks.subscribe.mockResolvedValue({ alreadySubscribed: false })
  })

  it('uses only the authenticated Rock person', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ subscribed: true, alreadySubscribed: false })
    expect(mocks.subscribe).toHaveBeenCalledWith(42)
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('rejects cross-origin requests before reading the session', async () => {
    const response = await POST(request('https://attacker.example'))
    expect(response.status).toBe(403)
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('requires a resolved member session', async () => {
    mocks.getSession.mockResolvedValue(null)
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(mocks.subscribe).not.toHaveBeenCalled()
  })

  it('returns a generic retryable error when Rock fails', async () => {
    mocks.subscribe.mockRejectedValue(new Error('secret upstream details'))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Unable to sign you up right now' })
  })
})
