import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  respondToVolunteerSchedule: vi.fn(),
}))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ getSession: mocks.getSession }),
}))
vi.mock('@/lib/members/volunteer-scheduling', () => ({
  respondToVolunteerSchedule: mocks.respondToVolunteerSchedule,
}))

import { POST } from './route'
import * as responseRoute from './route'

const assignmentId = 'rock-schedule:11111111-1111-4111-8111-111111111111'

function session(personId = 42, impersonating = false) {
  return {
    user: { sub: `auth0|${personId}` },
    rockProfile: {
      version: 3,
      status: 'resolved',
      profile: {
        personId,
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
        photoUrl: null,
        campusSlug: 'north',
      },
    },
    ...(impersonating ? {
      memberImpersonation: {
        version: 1,
        status: 'active',
        originalHadRockProfile: false,
        originalRockProfile: null,
        targetProfile: {
          personId,
          name: 'Aroha Ngata',
          email: 'aroha@example.com',
          photoUrl: null,
          campusSlug: 'north',
        },
      },
    } : {}),
  }
}

function request(body: unknown, withCookie = true) {
  return new NextRequest('https://www.ev.church/api/member-service/respond', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://www.ev.church',
      ...(withCookie ? { cookie: '__Host-ev_admin_session=one' } : {}),
    },
    body: JSON.stringify(body),
  })
}

function proxiedRequest(body: unknown) {
  return new NextRequest('http://0.0.0.0:3000/api/member-service/respond', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://www.ev.church',
      cookie: '__Host-ev_admin_session=one',
    },
    body: JSON.stringify(body),
  })
}

function expectPrivate(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('vary')).toContain('Cookie')
}

describe('member service response route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue(session())
    mocks.respondToVolunteerSchedule.mockResolvedValue({ status: 'accepted' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exports only the POST mutation handler', () => {
    expect(Object.keys(responseRoute)).toEqual(['POST'])
  })

  it('responds for the current session person without exposing Rock identifiers', async () => {
    const response = await POST(request({ assignmentId, response: 'accept' }))

    expect(response.status).toBe(200)
    expectPrivate(response)
    expect(mocks.respondToVolunteerSchedule).toHaveBeenCalledWith(
      42,
      assignmentId,
      'accept',
      expect.any(Date),
      undefined,
    )
    await expect(response.json()).resolves.toEqual({ status: 'accepted' })
  })

  it('accepts the canonical public origin behind the Railway proxy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'www.ev.church')

    const response = await POST(proxiedRequest({ assignmentId, response: 'accept' }))

    expect(response.status).toBe(200)
    expect(mocks.respondToVolunteerSchedule).toHaveBeenCalledOnce()
  })

  it('rejects anonymous and impersonated mutations before calling Rock', async () => {
    const anonymous = await POST(request({ assignmentId, response: 'accept' }, false))
    expect(anonymous.status).toBe(401)
    expectPrivate(anonymous)

    mocks.getSession.mockResolvedValue(session(42, true))
    const impersonated = await POST(request({ assignmentId, response: 'decline' }))
    expect(impersonated.status).toBe(403)
    expectPrivate(impersonated)
    expect(mocks.respondToVolunteerSchedule).not.toHaveBeenCalled()
  })

  it('rejects an expired session even when a session cookie is present', async () => {
    mocks.getSession.mockResolvedValue(null)
    const response = await POST(request({ assignmentId, response: 'accept' }))

    expect(response.status).toBe(401)
    expectPrivate(response)
    expect(mocks.respondToVolunteerSchedule).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests before reading the session', async () => {
    const crossOrigin = request({ assignmentId, response: 'accept' })
    crossOrigin.headers.set('origin', 'https://example.com')
    const response = await POST(crossOrigin)

    expect(response.status).toBe(400)
    expectPrivate(response)
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.respondToVolunteerSchedule).not.toHaveBeenCalled()
  })

  it.each([
    [{ assignmentId: 'bad', response: 'accept' }],
    [{ assignmentId, response: 'decline' }],
    [{ assignmentId, response: 'accept', declineReasonId: 728 }],
    [{ assignmentId, response: 'maybe' }],
    [{ assignmentId, response: 'accept', attendanceId: 901 }],
  ])('rejects malformed or expanded mutation input', async (body) => {
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expectPrivate(response)
    expect(mocks.respondToVolunteerSchedule).not.toHaveBeenCalled()
  })

  it('passes a validated decline reason to the scheduling adapter', async () => {
    mocks.respondToVolunteerSchedule.mockResolvedValue({ status: 'declined' })
    const response = await POST(request({
      assignmentId,
      response: 'decline',
      declineReasonId: 728,
    }))

    expect(response.status).toBe(200)
    expect(mocks.respondToVolunteerSchedule).toHaveBeenCalledWith(
      42,
      assignmentId,
      'decline',
      expect.any(Date),
      728,
    )
  })

  it.each([
    ['stale', 409],
    ['busy', 429],
    ['rock-unavailable', 503],
    ['outcome-unknown', 503],
  ])('maps %s without leaking raw provider errors', async (status, expectedStatus) => {
    mocks.respondToVolunteerSchedule.mockResolvedValue({ status })
    const response = await POST(request({ assignmentId, response: 'accept' }))
    expect(response.status).toBe(expectedStatus)
    expectPrivate(response)
    expect(await response.text()).not.toContain('ROCK_API_KEY')
    if (status === 'busy') expect(response.headers.get('retry-after')).toBe('1')
  })
})
