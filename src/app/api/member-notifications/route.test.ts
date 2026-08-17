import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getVolunteerSchedule: vi.fn(),
}))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ getSession: mocks.getSession }),
}))
vi.mock('@/lib/members/volunteer-scheduling', () => ({
  getVolunteerSchedule: mocks.getVolunteerSchedule,
}))

import { __resetMemberNotificationLoadProtectionForTests, GET } from './route'
import * as notificationRoute from './route'

const PRIVATE_HEADERS = {
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
}

function request(session = 'one') {
  return new NextRequest('https://www.ev.church/api/member-notifications', {
    headers: { cookie: `__Host-ev_admin_session=${session}` },
  })
}

function session(personId = 42) {
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
  }
}

function available(requests: unknown[] = []) {
  return {
    status: 'available',
    requests,
    upcoming: [],
    declined: [],
  }
}

function expectPrivate(response: Response) {
  expect(response.headers.get('cache-control')).toBe(PRIVATE_HEADERS['cache-control'])
  expect(response.headers.get('pragma')).toBe(PRIVATE_HEADERS.pragma)
  expect(response.headers.get('vary')).toContain('Cookie')
}

describe('member notifications route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetMemberNotificationLoadProtectionForTests()
    mocks.getSession.mockResolvedValue(session())
    mocks.getVolunteerSchedule.mockResolvedValue(available())
  })

  it('exposes a read operation only, with no scheduling response handler', () => {
    expect(Object.keys(notificationRoute).sort()).toEqual([
      'GET',
      '__resetMemberNotificationLoadProtectionForTests',
    ])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns pending actionable notifications for the session person only', async () => {
    mocks.getVolunteerSchedule.mockResolvedValue(available([{
      id: 'rock-schedule:11111111-1111-4111-8111-111111111111',
      title: 'Welcome Team',
      occurrenceStart: '2026-08-16T09:00:00+12:00',
      scheduleName: '9am',
      locationName: null,
    }]))

    const response = await GET(request())

    expect(response.status).toBe(200)
    expectPrivate(response)
    expect(mocks.getVolunteerSchedule).toHaveBeenCalledWith(42, expect.any(Date), 'background')
    await expect(response.json()).resolves.toMatchObject({
      status: 'available',
      actionableCount: 1,
      items: [{
        id: 'rock-schedule:11111111-1111-4111-8111-111111111111',
        href: '/members/my-service#rock-schedule:11111111-1111-4111-8111-111111111111',
      }],
    })
  })

  it.each([
    ['missing cookie', new NextRequest('https://www.ev.church/api/member-notifications')],
    ['expired session', request()],
  ])('returns auth-required for %s without calling Rock', async (kind, memberRequest) => {
    if (kind === 'expired session') mocks.getSession.mockResolvedValue(null)

    const response = await GET(memberRequest)

    expect(response.status).toBe(401)
    expectPrivate(response)
    await expect(response.json()).resolves.toEqual({ status: 'auth-required' })
    expect(mocks.getVolunteerSchedule).not.toHaveBeenCalled()
  })

  it('returns unavailable rather than available-empty for provider failure', async () => {
    mocks.getVolunteerSchedule.mockResolvedValue({
      status: 'unavailable',
      reason: 'rock-unavailable',
      requests: [],
      upcoming: [],
      declined: [],
    })

    const response = await GET(request())

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('5')
    expectPrivate(response)
    await expect(response.json()).resolves.toMatchObject({
      status: 'unavailable',
      actionableCount: 0,
      items: [],
    })
  })

  it('preserves shared scheduling rate limits as 429 responses', async () => {
    mocks.getVolunteerSchedule.mockResolvedValue({
      status: 'unavailable',
      reason: 'rate-limited',
      retryAfterSeconds: 7,
      requests: [],
      upcoming: [],
      declined: [],
    })

    const response = await GET(request())

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('7')
    expectPrivate(response)
  })

  it('fails closed without leaking raw errors', async () => {
    mocks.getVolunteerSchedule.mockRejectedValue(new Error('secret upstream detail'))

    const response = await GET(request())

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('5')
    expectPrivate(response)
    expect(await response.text()).not.toContain('secret upstream detail')
  })

  it('allows normal refreshes and throttles sustained reads for one person', async () => {
    const responses = []
    for (let index = 0; index < 4; index += 1) responses.push(await GET(request()))
    const throttled = await GET(request())

    expect(responses.every(({ status }) => status === 200)).toBe(true)
    expect(throttled.status).toBe(429)
    expect(throttled.headers.get('retry-after')).toBe('10')
    expectPrivate(throttled)
    expect(mocks.getVolunteerSchedule).toHaveBeenCalledTimes(4)
  })

  it('rejects excess concurrent provider reads without queuing them', async () => {
    const resolvers: Array<(value: ReturnType<typeof available>) => void> = []
    mocks.getSession.mockImplementation((memberRequest: NextRequest) => {
      const personId = Number(memberRequest.cookies.get('__Host-ev_admin_session')?.value)
      return Promise.resolve(session(personId))
    })
    mocks.getVolunteerSchedule.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve)
    }))

    const first = GET(request('101'))
    const second = GET(request('102'))
    await vi.waitFor(() => expect(mocks.getVolunteerSchedule).toHaveBeenCalledTimes(2))
    const rejected = await GET(request('103'))

    expect(rejected.status).toBe(503)
    expect(rejected.headers.get('retry-after')).toBe('1')
    expectPrivate(rejected)
    expect(mocks.getVolunteerSchedule).toHaveBeenCalledTimes(2)

    resolvers.forEach((resolve) => resolve(available()))
    await Promise.all([first, second])
  })
})
