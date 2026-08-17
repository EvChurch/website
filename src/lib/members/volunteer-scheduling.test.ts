import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetVolunteerScheduleLoadProtectionForTests,
  getVolunteerSchedule,
  getVolunteerScheduleDeclineReasons,
  respondToVolunteerSchedule,
} from './volunteer-scheduling'

const GUIDS = {
  pending: '11111111-1111-4111-8111-111111111111',
  confirmed: '22222222-2222-4222-8222-222222222222',
  other: '33333333-3333-4333-8333-333333333333',
  tie: '44444444-4444-4444-8444-444444444444',
  foreign: '55555555-5555-4555-8555-555555555555',
  past: '66666666-6666-4666-8666-666666666666',
  declined: '77777777-7777-4777-8777-777777777777',
  noRsvp: '88888888-8888-4888-8888-888888888888',
  inactive: '99999999-9999-4999-8999-999999999999',
}

function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function attendance(overrides: Record<string, unknown> = {}) {
  const {
    OccurrenceDate = '2026-08-16T00:00:00',
    StartDateTime = '2026-08-16T09:00:00',
    OccurrenceId = 801,
    ...rest
  } = overrides
  return {
    Id: 901,
    Guid: GUIDS.pending,
    PersonAliasId: 142,
    RequestedToAttend: true,
    ScheduledToAttend: null,
    DidAttend: null,
    RSVP: 3,
    DeclineReasonValueId: null,
    OccurrenceId,
    StartDateTime,
    Occurrence: {
      Id: 801,
      OccurrenceDate,
      DidNotOccur: false,
      Group: { Id: 701, Name: 'Welcome Team', IsActive: true },
      Schedule: { Id: 601, Name: '9am', IsActive: true },
      Location: { Id: 501, Name: 'Main Auditorium', IsActive: true },
    },
    ...rest,
  }
}

function configure() {
  vi.stubEnv('ROCK_API_URL', 'https://rock.ev.church/api')
  vi.stubEnv('ROCK_API_KEY', 'shared-server-rock-key')
}

function deployedReadResponses(rows: ReturnType<typeof attendance>[]) {
  const occurrences = rows.map(({ Occurrence }) => ({
    Id: Occurrence.Id,
    GroupId: Occurrence.Group.Id,
    ScheduleId: Occurrence.Schedule?.Id ?? null,
    LocationId: Occurrence.Location?.Id ?? null,
    OccurrenceDate: Occurrence.OccurrenceDate,
    DidNotOccur: Occurrence.DidNotOccur,
  }))
  const distinctById = <T extends { Id: number }>(values: T[]) => [
    ...new Map(values.map((value) => [value.Id, value])).values(),
  ]
  return [
    rows.map(({ Occurrence: _Occurrence, ...row }) => row),
    distinctById(occurrences),
    distinctById(rows.map(({ Occurrence }) => Occurrence.Group)),
    distinctById(rows.flatMap(({ Occurrence }) => Occurrence.Schedule ? [Occurrence.Schedule] : [])),
    distinctById(rows.flatMap(({ Occurrence }) => Occurrence.Location ? [Occurrence.Location] : [])),
  ]
}

function queueDeployedRead(
  fetchMock: ReturnType<typeof vi.spyOn>,
  aliases: Array<{ Id: number; PersonId: number }>,
  rows: ReturnType<typeof attendance>[],
) {
  fetchMock.mockResolvedValueOnce(response(aliases))
  for (const value of deployedReadResponses(rows)) fetchMock.mockResolvedValueOnce(response(value))
}

describe('volunteer scheduling adapter', () => {
  beforeEach(() => {
    configure()
    __resetVolunteerScheduleLoadProtectionForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('partitions current-person pending requests from confirmed commitments', async () => {
    const rows = [
      attendance(),
      attendance({
        Id: 902,
        Guid: GUIDS.confirmed,
        PersonAliasId: 143,
        RequestedToAttend: false,
        ScheduledToAttend: true,
        RSVP: 1,
        OccurrenceId: 802,
        StartDateTime: '2026-08-17T18:30:00',
        Occurrence: {
          Id: 802,
          OccurrenceDate: '2026-08-17T00:00:00',
          DidNotOccur: false,
          Group: { Id: 702, Name: 'Youth Team', IsActive: true },
          Schedule: { Id: 602, Name: 'Evening', IsActive: true },
          Location: null,
        },
      }),
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([
        { Id: 142, PersonId: 42 },
        { Id: 143, PersonId: 42 },
      ]))
    for (const value of deployedReadResponses(rows)) fetchMock.mockResolvedValueOnce(response(value))

    await expect(getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z')))
      .resolves.toEqual({
        status: 'available',
        requests: [{
          id: `rock-schedule:${GUIDS.pending}`,
          title: 'Welcome Team',
          occurrenceStart: '2026-08-15T21:00:00.000Z',
          scheduleName: '9am',
          locationName: 'Main Auditorium',
        }],
        upcoming: [{
          id: `rock-schedule:${GUIDS.confirmed}`,
          title: 'Youth Team',
          occurrenceStart: '2026-08-17T06:30:00.000Z',
          scheduleName: 'Evening',
          locationName: null,
        }],
        declined: [],
      })

    expect(fetchMock).toHaveBeenCalledTimes(6)
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.method ?? 'GET').toBe('GET')
      expect(init?.body).toBeUndefined()
      expect(init?.headers).toEqual(expect.objectContaining({
        'Authorization-Token': 'shared-server-rock-key',
      }))
    }
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/PersonAlias',
      '/api/Attendances',
      '/api/AttendanceOccurrences',
      '/api/Groups',
      '/api/Schedules',
      '/api/Locations',
    ])
    expect(String(fetchMock.mock.calls[1][0])).toContain('PersonAliasId')
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('PersonId+eq+42')
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('%24expand')
  })

  it('keeps future declined assignments in a separate reversible state', async () => {
    const declinedAttendance = attendance({
      Guid: GUIDS.declined,
      ScheduledToAttend: false,
      RSVP: 0,
      DeclineReasonValueId: 77,
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [declinedAttendance])

    await expect(getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z')))
      .resolves.toEqual({
        status: 'available',
        requests: [],
        upcoming: [],
        declined: [{
          id: `rock-schedule:${GUIDS.declined}`,
          title: 'Welcome Team',
          occurrenceStart: '2026-08-15T21:00:00.000Z',
          scheduleName: '9am',
          locationName: 'Main Auditorium',
        }],
      })
  })

  it('excludes foreign, past, inactive, and safely malformed rows while retaining declines', async () => {
    const rows = [
        attendance({ Guid: GUIDS.foreign, PersonAliasId: 999 }),
        attendance({ Guid: GUIDS.past, OccurrenceDate: '2026-08-14T00:00:00', StartDateTime: '2026-08-14T09:00:00' }),
        attendance({ Guid: GUIDS.declined, DeclineReasonValueId: 77 }),
        attendance({ Guid: GUIDS.noRsvp, RSVP: 0 }),
        attendance({
          Guid: GUIDS.inactive,
          OccurrenceId: 803,
          Occurrence: {
            Id: 803,
            OccurrenceDate: '2026-08-16T00:00:00',
            DidNotOccur: false,
            Group: { Id: 703, Name: 'Inactive Team', IsActive: false },
            Schedule: { Id: 603, Name: '9am', IsActive: true },
            Location: null,
          },
        }),
      ]
    const [rawAttendances, ...related] = deployedReadResponses(rows)
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([...rawAttendances, { PersonAliasId: 999, unexpected: true }]))
    for (const value of related) fetchMock.mockResolvedValueOnce(response(value))

    await expect(getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z')))
      .resolves.toEqual({
        status: 'available',
        requests: [],
        upcoming: [],
        declined: [
          expect.objectContaining({ id: `rock-schedule:${GUIDS.declined}` }),
          expect.objectContaining({ id: `rock-schedule:${GUIDS.noRsvp}` }),
        ],
      })
  })

  it('resolves a non-primary alias and replaces stale state on a later read', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 143, PersonId: 42 }], [attendance({ PersonAliasId: 143 })])
    queueDeployedRead(fetchMock, [{ Id: 143, PersonId: 42 }], [attendance({
      PersonAliasId: 143,
      RequestedToAttend: false,
      ScheduledToAttend: true,
      RSVP: 1,
    })])

    const before = await getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z'))
    const after = await getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z'))

    expect(before.status === 'available' && before.requests).toHaveLength(1)
    expect(after.status === 'available' && after.requests).toHaveLength(0)
    expect(after.status === 'available' && after.upcoming).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(12)
  })

  it('deduplicates repeated GUIDs across pages and sorts equal times deterministically', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => attendance({
      Id: index === 0 ? 1_000 : 1_001,
      Guid: index === 0 ? GUIDS.tie : GUIDS.pending,
      StartDateTime: '2026-08-16T09:00:00',
    }))
    const secondPage = [
      attendance({ Id: 1_000, Guid: GUIDS.tie }),
      attendance({ Id: 2_000, Guid: GUIDS.other }),
    ]
    const [rawFirstPage] = deployedReadResponses(firstPage)
    const [rawSecondPage] = deployedReadResponses(secondPage)
    const [, occurrences, groups, schedules, locations] = deployedReadResponses([...firstPage, ...secondPage])
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response(rawFirstPage))
      .mockResolvedValueOnce(response(rawSecondPage))
      .mockResolvedValueOnce(response(occurrences))
      .mockResolvedValueOnce(response(groups))
      .mockResolvedValueOnce(response(schedules))
      .mockResolvedValueOnce(response(locations))

    const result = await getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z'))

    expect(result.status).toBe('available')
    if (result.status !== 'available') return
    expect(result.requests.map(({ id }) => id)).toEqual([
      `rock-schedule:${GUIDS.pending}`,
      `rock-schedule:${GUIDS.other}`,
      `rock-schedule:${GUIDS.tie}`,
    ])
  })

  it('chunks deployed Rock filters at the verified eight-ID boundary', async () => {
    const aliases = Array.from({ length: 9 }, (_, index) => ({
      Id: 200 + index,
      PersonId: 42,
    }))
    const rows = aliases.map((alias, index) => attendance({
      Id: 1_200 + index,
      Guid: `${(index + 10).toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      PersonAliasId: alias.Id,
      OccurrenceId: 900 + index,
      Occurrence: {
        Id: 900 + index,
        OccurrenceDate: '2026-08-16T00:00:00',
        DidNotOccur: false,
        Group: { Id: 700 + index, Name: `Team ${index}`, IsActive: true },
        Schedule: { Id: 600 + index, Name: `Time ${index}`, IsActive: true },
        Location: { Id: 500 + index, Name: `Room ${index}`, IsActive: true },
      },
    }))
    const [raw, occurrences, groups, schedules, locations] = deployedReadResponses(rows)
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response(aliases))
      .mockResolvedValueOnce(response(raw.slice(0, 8)))
      .mockResolvedValueOnce(response(raw.slice(8)))
      .mockResolvedValueOnce(response(occurrences.slice(0, 8)))
      .mockResolvedValueOnce(response(occurrences.slice(8)))
      .mockResolvedValueOnce(response(groups.slice(0, 8)))
      .mockResolvedValueOnce(response(schedules.slice(0, 8)))
      .mockResolvedValueOnce(response(locations.slice(0, 8)))
      .mockResolvedValueOnce(response(groups.slice(8)))
      .mockResolvedValueOnce(response(schedules.slice(8)))
      .mockResolvedValueOnce(response(locations.slice(8)))

    const result = await getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z'))

    expect(result.status === 'available' && result.requests).toHaveLength(9)
    for (const [requestUrl] of fetchMock.mock.calls.slice(1)) {
      const filter = new URL(String(requestUrl)).searchParams.get('$filter') ?? ''
      const idTerms = filter.match(/(?:PersonAliasId|Id) eq \d+/gu) ?? []
      expect(idTerms.length).toBeLessThanOrEqual(8)
    }
  })

  it.each([
    ['standard time', '2026-07-04T12:01:00Z', '2026-07-05T00:00:00', '2026-07-05T09:00:00', '2026-07-04T21:00:00.000Z'],
    ['daylight time', '2026-12-31T11:01:00Z', '2027-01-01T00:00:00', '2027-01-01T09:00:00', '2026-12-31T20:00:00.000Z'],
  ])('uses Auckland dates and service times during %s', async (_label, now, occurrenceDate, startDateTime, expected) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [
      attendance({ OccurrenceDate: occurrenceDate, StartDateTime: startDateTime }),
    ])

    const result = await getVolunteerSchedule(42, new Date(now))

    expect(result.status === 'available' && result.requests).toHaveLength(1)
    expect(result.status === 'available' && result.requests[0]?.occurrenceStart).toBe(expected)
  })

  it('treats Rock nullable DidNotOccur as not cancelled', async () => {
    const row = attendance()
    row.Occurrence.DidNotOccur = null as unknown as boolean
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [row])

    const result = await getVolunteerSchedule(42, new Date('2026-08-15T00:00:00Z'))

    expect(result.status === 'available' && result.requests).toHaveLength(1)
  })

  it('excludes an earlier-today assignment but retains a later one', async () => {
    const earlier = attendance({
      Guid: GUIDS.other,
      StartDateTime: '2026-08-16T08:00:00',
    })
    const later = attendance({
      Guid: GUIDS.pending,
      StartDateTime: '2026-08-16T10:00:00',
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [earlier, later])

    const result = await getVolunteerSchedule(42, new Date('2026-08-15T21:30:00Z'))

    expect(result.status === 'available' && result.requests.map(({ id }) => id)).toEqual([
      `rock-schedule:${GUIDS.pending}`,
    ])
  })

  it('returns available empty when Rock confirms there are no assignments', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([]))

    await expect(getVolunteerSchedule(42)).resolves.toEqual({
      status: 'available',
      requests: [],
      upcoming: [],
      declined: [],
    })
  })

  it('treats a missing person alias as an invalid identity', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response([]))

    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'invalid-person', requests: [], upcoming: [],
    })
  })

  it.each([
    ['missing key', { ROCK_API_KEY: '' }],
    ['non-HTTPS API origin', { ROCK_API_URL: 'http://rock.ev.church/api' }],
    ['unexpected API path', { ROCK_API_URL: 'https://rock.ev.church/rest' }],
    ['URL credentials', { ROCK_API_URL: 'https://user:pass@rock.ev.church/api' }],
  ])('fails closed for %s', async (_label, environment) => {
    for (const [name, value] of Object.entries(environment)) vi.stubEnv(name, value)
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(getVolunteerSchedule(42)).resolves.toEqual({
      status: 'unavailable',
      reason: 'invalid-configuration',
      requests: [],
      upcoming: [],
      declined: [],
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('distinguishes transport and malformed failures from available empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network failed'))
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'rock-unavailable', requests: [], upcoming: [],
    })

    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ not: 'an array' }))
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'malformed-response', requests: [], upcoming: [],
    })
  })

  it('classifies a timeout while reading the response body as unavailable', async () => {
    const operationController = new AbortController()
    const requestController = new AbortController()
    vi.spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(operationController.signal)
      .mockReturnValueOnce(requestController.signal)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        requestController.signal.addEventListener(
          'abort',
          () => reject(requestController.signal.reason),
          { once: true },
        )
      }),
    } as Response)

    const result = getVolunteerSchedule(42)
    await Promise.resolve()
    requestController.abort(new DOMException('Timed out', 'TimeoutError'))

    await expect(result).resolves.toMatchObject({
      status: 'unavailable', reason: 'rock-unavailable', requests: [], upcoming: [],
    })
  })

  it('rejects Rock redirects without forwarding the scheduling credential', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { Location: 'https://other.example/api/PersonAlias' },
    }))

    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'rock-unavailable',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', redirect: 'error' })
  })

  it('fails closed when an owned row is malformed or pagination does not advance', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance({ StartDateTime: 'not-a-date' })]))
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'malformed-response', requests: [], upcoming: [],
    })

    vi.restoreAllMocks()
    const repeatedPage = Array.from({ length: 100 }, (_, index) => ({ Id: index + 1, PersonId: 42 }))
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response(repeatedPage))
      .mockResolvedValueOnce(response(repeatedPage))
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'malformed-response', requests: [], upcoming: [],
    })
  })

  it('fails closed for mismatched occurrence identity and advancing unbounded pages', async () => {
    const mismatched = attendance({ OccurrenceId: 999 })
    const [raw, occurrences, groups, schedules, locations] = deployedReadResponses([mismatched])
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response(raw))
      .mockResolvedValueOnce(response(occurrences))
      .mockResolvedValueOnce(response(groups))
      .mockResolvedValueOnce(response(schedules))
      .mockResolvedValueOnce(response(locations))
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'malformed-response',
    })

    vi.restoreAllMocks()
    let page = 0
    const paginationFetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const start = page++ * 100
      return Promise.resolve(response(Array.from({ length: 100 }, (_, index) => ({
        Id: start + index + 1,
        PersonId: 42,
      }))))
    })
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'malformed-response',
    })
    expect(paginationFetchMock).toHaveBeenCalledTimes(10)
  })

  it('fails closed when duplicate Attendance rows conflict', async () => {
    const original = attendance()
    const conflicting = attendance({ ScheduledToAttend: true, RSVP: 1 })
    const [raw, occurrences, groups, schedules, locations] = deployedReadResponses([
      original,
      conflicting,
    ])
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response(raw))
      .mockResolvedValueOnce(response(occurrences))
      .mockResolvedValueOnce(response(groups))
      .mockResolvedValueOnce(response(schedules))
      .mockResolvedValueOnce(response(locations))

    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'malformed-response',
    })
  })

  it('fails closed when Rock omits referenced scheduling metadata', async () => {
    const row = attendance()
    const [raw, occurrences, _groups, schedules, locations] = deployedReadResponses([row])
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response(raw))
      .mockResolvedValueOnce(response(occurrences))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(schedules))
      .mockResolvedValueOnce(response(locations))

    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'malformed-response',
    })
  })

  it('coalesces same-person reads and rejects a third concurrent person', async () => {
    const resolvers: Array<(value: Response) => void> = []
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      new Promise<Response>((resolve) => resolvers.push(resolve)),
    )

    const first = getVolunteerSchedule(41, new Date(), 'background')
    const samePerson = getVolunteerSchedule(41, new Date(), 'foreground')
    const second = getVolunteerSchedule(42)
    const rejected = getVolunteerSchedule(43, new Date(), 'background')

    expect(samePerson).toBe(first)
    await expect(rejected).resolves.toMatchObject({
      status: 'unavailable', reason: 'rock-unavailable',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    resolvers.forEach((resolve) => resolve(response([])))
    await Promise.all([first, second])
  })

  it('bounds sequential reads while reserving a foreground slot', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(response([])),
    )

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(getVolunteerSchedule(42, new Date(), 'background')).resolves.toMatchObject({
        status: 'unavailable', reason: 'invalid-person',
      })
    }
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'invalid-person',
    })
    await expect(getVolunteerSchedule(42)).resolves.toMatchObject({
      status: 'unavailable', reason: 'rate-limited', retryAfterSeconds: 10,
    })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('keeps schedule reads GET-only', async () => {
    const module = await import('./volunteer-scheduling')
    expect(Object.keys(module).sort()).toEqual([
      '__resetVolunteerScheduleLoadProtectionForTests',
      'getVolunteerSchedule',
      'getVolunteerScheduleDeclineReasons',
      'respondToVolunteerSchedule',
    ])

    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [attendance()])
    await module.getVolunteerSchedule(42)

    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true)
    expect(fetchMock.mock.calls.every(([, init]) => init?.body === undefined)).toBe(true)
  })

  it('uses Rock canonical accept action once and verifies the read-back', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [attendance()])
    fetchMock
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance()]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance({ ScheduledToAttend: true, RSVP: 1 })]))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )).resolves.toEqual({ status: 'accepted' })

    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(writes).toHaveLength(1)
    expect(new URL(String(writes[0]?.[0])).pathname).toBe('/api/Attendances/ScheduledPersonConfirm')
    expect(new URL(String(writes[0]?.[0])).searchParams.get('attendanceId')).toBe('901')
    expect(writes[0]?.[1]).toMatchObject({ redirect: 'error' })
    expect(writes[0]?.[1]?.body).toBeUndefined()
  })

  it('declines an owned confirmed upcoming commitment', async () => {
    const confirmedAttendance = attendance({ ScheduledToAttend: true, RSVP: 1 })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [confirmedAttendance])
    fetchMock
      .mockResolvedValueOnce(response([{
        Id: 76,
        Guid: '70c9f9c4-20cc-43dd-888d-9243853a0e52',
      }]))
      .mockResolvedValueOnce(response([{
        Id: 728,
        Value: 'Family Emergency',
        IsActive: true,
      }]))
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([confirmedAttendance]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance({
        ScheduledToAttend: false,
        RSVP: 0,
        DeclineReasonValueId: 728,
      })]))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'decline',
      new Date('2026-08-15T00:00:00Z'),
      728,
    )).resolves.toEqual({ status: 'declined' })

    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(writes).toHaveLength(1)
    expect(new URL(String(writes[0]?.[0])).pathname)
      .toBe('/api/Attendances/901')
    expect(JSON.parse(String(writes[0]?.[1]?.body))).toEqual({
      ScheduledToAttend: false,
      RSVPDateTime: '2026-08-15T00:00:00.000Z',
      RSVP: 0,
      DeclineReasonValueId: 728,
    })
  })

  it('loads active Rock schedule decline reasons for the member page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([{
        Id: 76,
        Guid: '70c9f9c4-20cc-43dd-888d-9243853a0e52',
      }]))
      .mockResolvedValueOnce(response([
        { Id: 728, Value: 'Family Emergency', IsActive: true },
        { Id: 729, Value: 'Have to Work', IsActive: true },
      ]))

    await expect(getVolunteerScheduleDeclineReasons()).resolves.toEqual([
      { id: 728, label: 'Family Emergency' },
      { id: 729, label: 'Have to Work' },
    ])
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true)
  })

  it('reconfirms an owned future declined assignment', async () => {
    const declinedAttendance = attendance({ ScheduledToAttend: false, RSVP: 0 })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [declinedAttendance])
    fetchMock
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([declinedAttendance]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance({ ScheduledToAttend: true, RSVP: 1 })]))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )).resolves.toEqual({ status: 'accepted' })

    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(writes).toHaveLength(1)
    expect(new URL(String(writes[0]?.[0])).pathname)
      .toBe('/api/Attendances/ScheduledPersonConfirm')
  })

  it('does not accept an already confirmed commitment', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [
      attendance({ ScheduledToAttend: true, RSVP: 1 }),
    ])

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )).resolves.toEqual({ status: 'stale' })
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('refuses a foreign attendance before sending any write', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [attendance()])
    fetchMock
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance({ PersonAliasId: 999 })]))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )).resolves.toEqual({ status: 'stale' })
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('never retries an ambiguous write or claims success without canonical state', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [attendance()])
    fetchMock
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance()]))
      .mockRejectedValueOnce(new TypeError('connection dropped'))
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance()]))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )).resolves.toEqual({ status: 'outcome-unknown' })
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
  })

  it('reports outcome unknown when a successful write cannot be read back', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [attendance()])
    fetchMock
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance()]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new TypeError('read-back failed'))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )).resolves.toEqual({ status: 'outcome-unknown' })
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
  })

  it.each([
    { ScheduledToAttend: true, RSVP: 1 },
    { DidAttend: true },
  ])('refuses an owned request whose current state is no longer pending: %o', async (state) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    queueDeployedRead(fetchMock, [{ Id: 142, PersonId: 42 }], [attendance()])
    fetchMock
      .mockResolvedValueOnce(response([{ Id: 142, PersonId: 42 }]))
      .mockResolvedValueOnce(response([attendance(state)]))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )).resolves.toEqual({ status: 'stale' })
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('rejects malformed assignment identities without contacting Rock', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(respondToVolunteerSchedule(42, 'rock-schedule:901', 'accept'))
      .resolves.toEqual({ status: 'invalid-request' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows only one response mutation per person at a time', async () => {
    let resolveAliases!: (value: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise((resolve) => {
      resolveAliases = resolve
    }))
    const first = respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.pending}`,
      'accept',
      new Date('2026-08-15T00:00:00Z'),
    )
    await vi.waitFor(() => expect(resolveAliases).toBeTypeOf('function'))

    await expect(respondToVolunteerSchedule(
      42,
      `rock-schedule:${GUIDS.other}`,
      'decline',
      new Date('2026-08-15T00:00:00Z'),
      728,
    )).resolves.toEqual({ status: 'busy' })

    resolveAliases(response([]))
    await expect(first).resolves.toEqual({ status: 'rock-unavailable' })
  })
})
