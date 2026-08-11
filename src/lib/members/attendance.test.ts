import { beforeEach, describe, expect, it, vi } from 'vitest'

const rock = vi.hoisted(() => ({ rockFetchAll: vi.fn() }))

vi.mock('@/lib/rock-api', () => ({ rockFetchAll: rock.rockFetchAll }))
vi.mock('next/cache', () => ({ unstable_cache: (callback: unknown) => callback }))

import {
  buildAttendanceOverview,
  fetchConnectGroupAttendance,
} from './attendance'

const groupOccurrences = [
  { Id: 1, GroupId: 10, OccurrenceDate: '2026-07-15T00:00:00', DidNotOccur: false },
  { Id: 2, GroupId: 10, OccurrenceDate: '2026-07-22T00:00:00', DidNotOccur: false },
  { Id: 3, GroupId: 10, OccurrenceDate: '2026-07-29T00:00:00', DidNotOccur: false },
  { Id: 4, GroupId: 10, OccurrenceDate: '2026-08-05T00:00:00', DidNotOccur: false },
]

function attendance(
  id: number,
  personId: number,
  date: string,
  didAttend = true,
) {
  return {
    Id: id,
    DidAttend: didAttend,
    PersonAliasId: personId,
    OccurrenceId: groupOccurrences.find((occurrence) => occurrence.OccurrenceDate.startsWith(date))?.Id ?? id,
    StartDateTime: `${date}T00:00:00`,
  }
}

describe('buildAttendanceOverview', () => {
  it('flags two trailing misses in either attendance series', () => {
    const overview = buildAttendanceOverview({
      rockPersonIds: [84, 85],
      groupOccurrences,
      personAliases: [{ Id: 84, PersonId: 84 }, { Id: 85, PersonId: 85 }],
      groupAttendances: [
        attendance(1, 84, '2026-07-15'),
        attendance(2, 84, '2026-07-22'),
        attendance(3, 84, '2026-07-29', false),
        attendance(4, 84, '2026-08-05', false),
        attendance(5, 85, '2026-07-15'),
        attendance(6, 85, '2026-07-22'),
        attendance(7, 85, '2026-07-29'),
        attendance(8, 85, '2026-08-05'),
      ],
      churchOccurrences: [
        { Id: 20, OccurrenceDate: '2026-07-19T00:00:00' },
        { Id: 21, OccurrenceDate: '2026-07-26T00:00:00' },
        { Id: 24, OccurrenceDate: '2026-08-02T00:00:00' },
        { Id: 25, OccurrenceDate: '2026-08-09T00:00:00' },
      ],
      churchAttendances: [
        attendance(20, 84, '2026-07-19'),
        attendance(21, 84, '2026-07-26'),
        attendance(22, 85, '2026-07-19'),
        attendance(23, 85, '2026-07-26'),
        attendance(24, 85, '2026-08-02'),
        attendance(25, 85, '2026-08-09'),
      ],
      now: new Date('2026-08-11T00:00:00.000Z'),
    })

    expect(overview.people[84]).toMatchObject({
      needsAttention: true,
      attentionLabel: '2 CGs missed · 2 Sundays missed',
      connectGroup: {
        missedInARow: 2,
        recent: [
          { date: '2026-07-15', didAttend: true },
          { date: '2026-07-22', didAttend: true },
          { date: '2026-07-29', didAttend: false },
          { date: '2026-08-05', didAttend: false },
        ],
      },
      church: { missedInARow: 2 },
    })
    expect(overview.people[85].needsAttention).toBe(false)
  })

  it('keeps the four recent marks while calculating year-to-date context', () => {
    const overview = buildAttendanceOverview({
      rockPersonIds: [84],
      groupOccurrences,
      personAliases: [{ Id: 84, PersonId: 84 }],
      groupAttendances: [
        attendance(1, 84, '2026-07-15'),
        attendance(2, 84, '2026-07-22'),
        attendance(3, 84, '2026-07-29', false),
        attendance(4, 84, '2026-08-05', false),
      ],
      churchOccurrences: [{ Id: 20, OccurrenceDate: '2026-08-09T00:00:00' }],
      churchAttendances: [{ ...attendance(20, 84, '2026-08-09'), OccurrenceId: 20 }],
      now: new Date('2026-08-11T00:00:00.000Z'),
    })

    expect(overview.people[84].connectGroup.ytdPercentage).toBe(50)
    expect(overview.people[84].church.recent).toHaveLength(1)
    expect(overview.people[84].church.recent.at(-1)).toEqual({
      date: '2026-08-09',
      didAttend: true,
    })
    expect(overview.summary.connectGroup).toEqual({ recentPercentage: 50, ytdPercentage: 50 })
    expect(overview.monthly.at(-1)).toMatchObject({
      month: '2026-08',
      connectGroupPercentage: 0,
    })
  })

  it('ignores group occurrences explicitly marked as not meeting', () => {
    const overview = buildAttendanceOverview({
      rockPersonIds: [84],
      groupOccurrences: [
        ...groupOccurrences,
        { Id: 5, GroupId: 10, OccurrenceDate: '2026-08-12T00:00:00', DidNotOccur: true },
      ],
      groupAttendances: [
        { ...attendance(5, 84, '2026-08-12'), OccurrenceId: 5 },
      ],
      personAliases: [{ Id: 84, PersonId: 84 }],
      churchAttendances: [],
      now: new Date('2026-08-13T00:00:00.000Z'),
    })

    expect(overview.people[84].connectGroup.recent.map((mark) => mark.date)).not.toContain(
      '2026-08-12',
    )
  })

  it('uses actual weekend occurrences, including earlier and non-Sunday services', () => {
    const overview = buildAttendanceOverview({
      rockPersonIds: [84],
      groupOccurrences,
      personAliases: [{ Id: 84, PersonId: 84 }],
      groupAttendances: [attendance(1, 84, '2026-07-15')],
      churchOccurrences: [
        { Id: 20, OccurrenceDate: '2026-07-11T00:00:00' },
        { Id: 21, OccurrenceDate: '2026-07-19T00:00:00', DidNotOccur: true },
        { Id: 22, OccurrenceDate: '2026-07-21T00:00:00' },
      ],
      churchAttendances: [
        { ...attendance(20, 84, '2026-07-11'), OccurrenceId: 20 },
        { ...attendance(22, 84, '2026-07-21'), OccurrenceId: 22 },
      ],
      now: new Date('2026-08-11T00:00:00.000Z'),
    })

    expect(overview.people[84].church.recent).toEqual([
      { date: '2026-07-11', didAttend: true },
      { date: '2026-07-21', didAttend: true },
    ])
  })
})

describe('fetchConnectGroupAttendance', () => {
  beforeEach(() => rock.rockFetchAll.mockReset())

  it('uses bounded server-side Rock queries for the requested roster', async () => {
    rock.rockFetchAll
      .mockResolvedValueOnce([{ Id: 84, PersonId: 84 }, { Id: 85, PersonId: 85 }])
      .mockResolvedValueOnce(groupOccurrences)
      .mockResolvedValueOnce([{ Id: 14 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await fetchConnectGroupAttendance(10, [84, 85], new Date('2026-08-11T00:00:00.000Z'))

    expect(rock.rockFetchAll).toHaveBeenCalledTimes(5)
    expect(rock.rockFetchAll.mock.calls[1][0]).toMatchObject({
      endpoint: 'AttendanceOccurrences',
      params: { $filter: expect.stringContaining('GroupId eq 10') },
      retries: 0,
      timeoutMs: 5000,
    })
    expect(rock.rockFetchAll.mock.calls[4][0]).toMatchObject({
      endpoint: 'Attendances',
      params: {
        $filter: expect.stringMatching(/PersonAliasId eq 84.*PersonAliasId eq 85/),
      },
      retries: 0,
      timeoutMs: 5000,
    })
  })
})
