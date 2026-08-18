import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  getSession: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ getSession: mocks.getSession }),
}))
vi.mock('@/lib/members/volunteer-scheduling', () => ({
  deleteVolunteerScheduleUnavailability: mocks.delete,
  saveVolunteerScheduleUnavailability: mocks.save,
}))

import { DELETE, POST } from './route'

function session(impersonating = false) {
  const profile = {
    personId: 42,
    name: 'Aroha Ngata',
    email: 'aroha@example.com',
    photoUrl: null,
    campusSlug: 'north',
  }
  return {
    user: { sub: 'auth0|42' },
    rockProfile: { version: 3, status: 'resolved', profile },
    ...(impersonating ? {
      memberImpersonation: {
        version: 1,
        status: 'active',
        originalHadRockProfile: false,
        originalRockProfile: null,
        targetProfile: profile,
      },
    } : {}),
  }
}

function request(body: unknown, origin = 'https://www.ev.church', method = 'POST') {
  return new NextRequest('https://www.ev.church/api/member-service/unavailability', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      cookie: '__Host-ev_admin_session=one',
    },
    body: JSON.stringify(body),
  })
}

describe('member service unavailability route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue(session())
    mocks.delete.mockResolvedValue({ status: 'deleted' })
    mocks.save.mockResolvedValue({ status: 'saved' })
  })

  it('saves only for the signed-in person', async () => {
    const input = { startDate: '2026-08-20', endDate: '2026-08-22', groupId: 701, notes: 'Away' }
    const response = await POST(request(input))

    expect(response.status).toBe(200)
    expect(mocks.save).toHaveBeenCalledWith(42, input)
    await expect(response.json()).resolves.toEqual({ status: 'saved' })
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
  })

  it('rejects cross-origin, impersonated, and expanded requests before saving', async () => {
    expect((await POST(request({}, 'https://example.com'))).status).toBe(400)

    mocks.getSession.mockResolvedValue(session(true))
    expect((await POST(request({ startDate: '2026-08-20', endDate: '2026-08-22' }))).status).toBe(403)

    mocks.getSession.mockResolvedValue(session())
    expect((await POST(request({
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      personId: 99,
    }))).status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid-request', 400],
    ['busy', 429],
    ['rock-unavailable', 503],
    ['outcome-unknown', 503],
  ])('maps %s without leaking provider details', async (status, expectedStatus) => {
    mocks.save.mockResolvedValue({ status })
    const response = await POST(request({ startDate: '2026-08-20', endDate: '2026-08-22' }))
    expect(response.status).toBe(expectedStatus)
    if (status === 'busy') expect(response.headers.get('retry-after')).toBe('1')
  })

  it('removes only a signed-in person owned unavailability', async () => {
    const id = 'rock-unavailability:33333333-3333-4333-8333-333333333333'
    const response = await DELETE(request({ id }, 'https://www.ev.church', 'DELETE'))

    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith(42, id)
    await expect(response.json()).resolves.toEqual({ status: 'deleted' })
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
  })

  it('rejects expanded deletion requests before removing', async () => {
    const response = await DELETE(request({ id: 'one', personId: 99 }, 'https://www.ev.church', 'DELETE'))

    expect(response.status).toBe(400)
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid-request', 400],
    ['busy', 429],
    ['rock-unavailable', 503],
    ['outcome-unknown', 503],
  ])('maps DELETE %s without leaking provider details', async (status, expectedStatus) => {
    mocks.delete.mockResolvedValue({ status })
    const response = await DELETE(request({
      id: 'rock-unavailability:33333333-3333-4333-8333-333333333333',
    }, 'https://www.ev.church', 'DELETE'))

    expect(response.status).toBe(expectedStatus)
    if (status === 'busy') expect(response.headers.get('retry-after')).toBe('1')
  })

  it('rejects cross-origin and impersonated deletion requests', async () => {
    const id = 'rock-unavailability:33333333-3333-4333-8333-333333333333'
    expect((await DELETE(request({ id }, 'https://example.com', 'DELETE'))).status).toBe(400)

    mocks.getSession.mockResolvedValue(session(true))
    expect((await DELETE(request({ id }, 'https://www.ev.church', 'DELETE'))).status).toBe(403)
    expect(mocks.delete).not.toHaveBeenCalled()
  })
})
