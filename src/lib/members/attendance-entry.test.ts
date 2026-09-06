import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rockFetch: vi.fn(),
  rockFetchAll: vi.fn(),
}))

vi.mock('@/lib/rock-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rock-api')>()
  return { ...actual, rockFetch: mocks.rockFetch, rockFetchAll: mocks.rockFetchAll }
})

import {
  buildRecentScheduledMeetings,
  getConnectGroupAttendanceEntry,
  getLiveAttendanceWriteContext,
  loadConnectGroupAttendanceMeeting,
  saveConnectGroupAttendanceMeeting,
  type AttendanceMeetingIdentity,
} from './attendance-entry'

const meeting: AttendanceMeetingIdentity = {
  date: '2026-08-12',
  startDateTime: '2026-08-12T19:30:00',
  scheduleId: 20,
  locationId: null,
  occurrenceId: null,
}

describe('Connect Group attendance entry', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns the latest four non-future scheduled meetings', () => {
    expect(buildRecentScheduledMeetings({
      group: {
        Id: 10,
        Schedule: { Id: 20, WeeklyDayOfWeek: 3, WeeklyTimeOfDay: '19:30:00' },
      },
      occurrences: [],
      now: new Date('2026-08-14T00:00:00Z'),
    })).toEqual([
      { ...meeting, occurrenceId: null },
      { ...meeting, date: '2026-08-05', startDateTime: '2026-08-05T19:30:00', occurrenceId: null },
      { ...meeting, date: '2026-07-29', startDateTime: '2026-07-29T19:30:00', occurrenceId: null },
      { ...meeting, date: '2026-07-22', startDateTime: '2026-07-22T19:30:00', occurrenceId: null },
    ])
  })

  it('retains distinct same-day schedule identities and canonical occurrence IDs', () => {
    expect(buildRecentScheduledMeetings({
      group: {
        Id: 10,
        GroupLocations: [
          { LocationId: 30, Schedules: [{ Id: 20, WeeklyDayOfWeek: 3 }] },
          { LocationId: 31, Schedules: [{ Id: 21, WeeklyDayOfWeek: 3 }] },
        ],
      },
      occurrences: [{
        Id: 99, GroupId: 10, LocationId: 30, ScheduleId: 20,
        OccurrenceDate: '2026-08-12T00:00:00',
      }],
      now: new Date('2026-08-14T00:00:00Z'),
    }).slice(0, 2)).toEqual([
      { date: '2026-08-12', startDateTime: '2026-08-12T00:00:00', scheduleId: 21, locationId: 31, occurrenceId: null },
      { date: '2026-08-12', startDateTime: '2026-08-12T00:00:00', scheduleId: 20, locationId: 30, occurrenceId: 99 },
    ])
  })

  it('fails closed when Rock supplies no usable schedule', () => {
    expect(() => buildRecentScheduledMeetings({
      group: { Id: 10, Schedule: { Id: 20 } },
      occurrences: [],
    })).toThrow('unambiguous active weekly schedule')
  })

  it('honours schedule effective dates', () => {
    const meetings = buildRecentScheduledMeetings({
      group: {
        Id: 10,
        Schedule: {
          Id: 20, WeeklyDayOfWeek: 3, EffectiveStartDate: '2026-07-29', EffectiveEndDate: '2026-08-12',
        },
      },
      occurrences: [],
      now: new Date('2026-08-14T00:00:00Z'),
    })
    expect(meetings.map((item) => item.date)).toEqual(['2026-08-12', '2026-08-05', '2026-07-29'])
  })

  it('defaults every roster person present only after a complete no-occurrence read', async () => {
    mocks.rockFetchAll.mockResolvedValueOnce([])

    await expect(loadConnectGroupAttendanceMeeting(10, meeting, [42, 84])).resolves.toEqual({
      identity: meeting,
      notes: '',
      didNotMeet: false,
      marks: { 42: 'present', 84: 'present' },
    })
  })

  it('loads present, absent, unrecorded, notes, and did-not-meet from Rock', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{
        Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null,
        OccurrenceDate: '2026-08-12T00:00:00', DidNotOccur: true, Notes: 'School holidays',
      }])
      .mockResolvedValueOnce([
        { Id: 42, PrimaryAliasId: 142 },
        { Id: 84, PrimaryAliasId: 184 },
        { Id: 126, PrimaryAliasId: 226 },
      ])
      .mockResolvedValueOnce([
        { Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: true },
        { Id: 2, OccurrenceId: 99, PersonAliasId: 184, DidAttend: false },
        { Id: 3, OccurrenceId: 99, PersonAliasId: 999, DidAttend: true },
      ])
      .mockResolvedValueOnce([])

    await expect(loadConnectGroupAttendanceMeeting(10, meeting, [42, 84, 126])).resolves.toMatchObject({
      identity: { ...meeting, occurrenceId: 99 },
      notes: 'School holidays',
      didNotMeet: true,
      marks: { 42: 'present', 84: 'absent', 126: 'unrecorded' },
    })
  })

  it('does not reinterpret a failed canonical read as a new meeting', async () => {
    mocks.rockFetchAll.mockRejectedValueOnce(new Error('Rock timeout'))
    await expect(loadConnectGroupAttendanceMeeting(10, meeting, [42]))
      .rejects.toThrow('Rock timeout')
  })

  it('loads the meeting list and newest canonical state together', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{ Id: 10, Schedule: { Id: 20, WeeklyDayOfWeek: 3, WeeklyTimeOfDay: '19:30:00' } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const entry = await getConnectGroupAttendanceEntry(
      10, [42], new Date('2026-08-14T00:00:00Z'),
    )
    expect(entry.meetings).toHaveLength(4)
    expect(entry.meetings[0]).toMatchObject({ date: '2026-08-12' })
    expect(entry.meetings[1]).toMatchObject({ date: '2026-08-05' })
    expect(entry.selectedMeeting).toMatchObject({ marks: { 42: 'present' } })
    expect(mocks.rockFetchAll).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'Groups',
      params: expect.objectContaining({
        $expand: 'Schedule,GroupLocations/Schedules',
      }),
    }))
  })

  it('proves live leadership and returns the current Rock roster', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{ Id: 10 }])
      .mockResolvedValueOnce([
        { Id: 1, GroupId: 10, GroupMemberStatus: 1, IsArchived: false, Person: { Id: 42 }, GroupRole: { IsLeader: true } },
        { Id: 2, GroupId: 10, GroupMemberStatus: 1, IsArchived: false, Person: { Id: 84 }, GroupRole: { IsLeader: false } },
      ])

    await expect(getLiveAttendanceWriteContext(10, 42)).resolves.toEqual({
      rosterRockPersonIds: [42, 84],
    })
    expect(mocks.rockFetchAll).toHaveBeenNthCalledWith(1, expect.objectContaining({
      endpoint: 'Groups',
      params: { $filter: 'Id eq 10 and IsActive eq true', $select: 'Id' },
    }))
    expect(mocks.rockFetchAll).toHaveBeenNthCalledWith(2, expect.objectContaining({
      endpoint: 'GroupMembers',
      params: expect.objectContaining({
        $filter: "GroupId eq 10 and GroupMemberStatus eq 'Active' and IsArchived eq false",
        $expand: 'Person,GroupRole',
      }),
    }))
  })

  it('denies a current non-leader at the live Rock boundary', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{ Id: 10 }])
      .mockResolvedValueOnce([
        { Id: 1, GroupId: 10, GroupMemberStatus: 1, IsArchived: false, Person: { Id: 42 }, GroupRole: { IsLeader: false } },
      ])
    await expect(getLiveAttendanceWriteContext(10, 42)).resolves.toBeNull()
  })

  it('updates only roster records and returns canonical read-back', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{ Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null, OccurrenceDate: meeting.date }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([
        { Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: false },
        { Id: 9, OccurrenceId: 99, PersonAliasId: 999, DidAttend: true },
      ])
      .mockResolvedValueOnce([{ Id: 999, PersonId: 9999 }])
      .mockResolvedValueOnce([
        { Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: false },
        { Id: 9, OccurrenceId: 99, PersonAliasId: 999, DidAttend: true },
      ])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 999, PersonId: 9999 }])
      .mockResolvedValueOnce([{ Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null, OccurrenceDate: meeting.date, Notes: 'Updated' }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: true }])
    mocks.rockFetch.mockResolvedValueOnce({ Id: 99 }).mockResolvedValue(undefined)

    const result = await saveConnectGroupAttendanceMeeting({
      groupId: 10, meeting, roster: [{ rockPersonId: 42, state: 'present' }],
      notes: ' Updated ', didNotMeet: false,
    })

    expect(result).toMatchObject({ status: 'saved', state: { notes: 'Updated', marks: { 42: 'present' } } })
    expect(mocks.rockFetch).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'Attendances/1', method: 'PUT', body: expect.objectContaining({ DidAttend: true }),
    }))
    expect(mocks.rockFetch).not.toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'Attendances/9', method: 'PUT' }))
  })

  it('updates an existing attendance recorded under a non-primary alias', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{ Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null, OccurrenceDate: meeting.date }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 7, OccurrenceId: 99, PersonAliasId: 777, DidAttend: false }])
      .mockResolvedValueOnce([{ Id: 777, PersonId: 42 }])
      .mockResolvedValueOnce([{ Id: 7, OccurrenceId: 99, PersonAliasId: 777, DidAttend: false }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 777, PersonId: 42 }])
      .mockResolvedValueOnce([{ Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null, OccurrenceDate: meeting.date }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 7, OccurrenceId: 99, PersonAliasId: 777, DidAttend: true }])
      .mockResolvedValueOnce([{ Id: 777, PersonId: 42 }])
    mocks.rockFetch.mockResolvedValueOnce({ Id: 99 }).mockResolvedValue(undefined)

    await expect(saveConnectGroupAttendanceMeeting({
      groupId: 10, meeting, roster: [{ rockPersonId: 42, state: 'present' }], notes: '', didNotMeet: false,
    })).resolves.toMatchObject({ status: 'saved', state: { marks: { 42: 'present' } } })
    expect(mocks.rockFetch).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'Attendances/7', method: 'PUT' }))
    expect(mocks.rockFetch).not.toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'Attendances', method: 'POST' }))
  })

  it('clears roster marks for did-not-meet without changing hidden visitors', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{ Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null, OccurrenceDate: meeting.date }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([
        { Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: true },
        { Id: 9, OccurrenceId: 99, PersonAliasId: 999, DidAttend: true },
      ])
      .mockResolvedValueOnce([{ Id: 999, PersonId: 9999 }])
      .mockResolvedValueOnce([
        { Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: true },
        { Id: 9, OccurrenceId: 99, PersonAliasId: 999, DidAttend: true },
      ])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 999, PersonId: 9999 }])
      .mockResolvedValueOnce([{ Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null, OccurrenceDate: meeting.date, DidNotOccur: true }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: null }])
    mocks.rockFetch.mockResolvedValueOnce({ Id: 99 }).mockResolvedValue(undefined)

    await expect(saveConnectGroupAttendanceMeeting({
      groupId: 10, meeting, roster: [{ rockPersonId: 42, state: 'present' }], notes: '', didNotMeet: true,
    })).resolves.toMatchObject({ status: 'saved', state: { didNotMeet: true } })
    expect(mocks.rockFetch).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'Attendances/1', method: 'PUT', body: expect.objectContaining({ DidAttend: null }) }))
    expect(mocks.rockFetch).not.toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'Attendances', method: 'POST' }))
    expect(mocks.rockFetch).not.toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'Attendances/9', method: 'PUT' }))
  })

  it('reports unknown mutation outcomes without retrying', async () => {
    mocks.rockFetchAll.mockResolvedValueOnce([])
    mocks.rockFetch.mockRejectedValueOnce(new Error('timeout'))

    await expect(saveConnectGroupAttendanceMeeting({
      groupId: 10, meeting, roster: [{ rockPersonId: 42, state: 'present' }], notes: '', didNotMeet: false,
    })).resolves.toMatchObject({ status: 'outcome-unknown' })
    expect(mocks.rockFetch).toHaveBeenCalledTimes(1)
  })

  it('reports a partial save as outcome unknown even when a later mutation is rejected', async () => {
    mocks.rockFetchAll
      .mockResolvedValueOnce([{ Id: 99, GroupId: 10, ScheduleId: 20, LocationId: null, OccurrenceDate: meeting.date }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
      .mockResolvedValueOnce([{ Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: false }])
      .mockResolvedValueOnce([{ Id: 1, OccurrenceId: 99, PersonAliasId: 142, DidAttend: false }])
      .mockResolvedValueOnce([{ Id: 42, PrimaryAliasId: 142 }])
    mocks.rockFetch
      .mockResolvedValueOnce({ Id: 99 })
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('bad request'), { status: 400 }))

    await expect(saveConnectGroupAttendanceMeeting({
      groupId: 10, meeting, roster: [{ rockPersonId: 42, state: 'present' }], notes: '', didNotMeet: false,
    })).resolves.toMatchObject({ status: 'outcome-unknown' })
  })

  it('rejects overlong notes before any Rock request', async () => {
    await expect(saveConnectGroupAttendanceMeeting({
      groupId: 10, meeting, roster: [], notes: 'a'.repeat(2001), didNotMeet: false,
    })).resolves.toMatchObject({ status: 'rejected' })
    expect(mocks.rockFetch).not.toHaveBeenCalled()
    expect(mocks.rockFetchAll).not.toHaveBeenCalled()
  })
})
