import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  liveAuthorize: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  entry: vi.fn(),
}))

vi.mock('@/lib/members/data', () => ({
  authorizeConnectGroupAttendanceLeader: mocks.authorize,
}))
vi.mock('@/lib/members/attendance-entry', () => ({
  getConnectGroupAttendanceEntry: mocks.entry,
  getLiveAttendanceWriteContext: mocks.liveAuthorize,
  loadConnectGroupAttendanceMeeting: mocks.load,
  saveConnectGroupAttendanceMeeting: mocks.save,
}))

import { loadAttendanceMeetingAction, saveAttendanceAction } from './actions'

const identity = { date: '2026-08-12', startDateTime: '2026-08-12T19:00:00+12:00', scheduleId: 8, locationId: 3, occurrenceId: 44 }
const people = [
  { rockPersonId: 1, name: 'Aroha' },
  { rockPersonId: 2, name: 'James' },
]

describe('attendance actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorize.mockResolvedValue({ access: 'granted', people, actorRockPersonId: 9 })
    mocks.liveAuthorize.mockResolvedValue({ rosterRockPersonIds: [1, 2] })
    mocks.entry.mockResolvedValue({ meetings: [identity], selectedMeeting: null })
  })

  it('reauthorizes before loading a meeting', async () => {
    mocks.load.mockResolvedValue({ identity, notes: '', didNotMeet: false, marks: {} })
    await loadAttendanceMeetingAction(10, identity)
    expect(mocks.authorize).toHaveBeenCalledWith(10)
    expect(mocks.load).toHaveBeenCalledWith(10, identity, [1, 2])
  })

  it('rejects a meeting outside the server-resolved recent set', async () => {
    mocks.entry.mockResolvedValue({ meetings: [], selectedMeeting: null })

    await expect(saveAttendanceAction(10, {
      meeting: { ...identity, date: '2030-01-01' },
      marks: { 1: 'present', 2: 'absent' },
      notes: '',
      didNotMeet: false,
    })).resolves.toMatchObject({ status: 'rejected' })
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('rejects malformed server action input', async () => {
    await expect(saveAttendanceAction(10, {
      meeting: identity,
      marks: { 1: 'present' },
      notes: '',
      didNotMeet: 'yes',
    })).resolves.toMatchObject({ status: 'rejected' })
    expect(mocks.authorize).not.toHaveBeenCalled()
  })

  it('denies a direct save before any Rock mutation', async () => {
    mocks.authorize.mockResolvedValue({ access: 'denied' })
    const result = await saveAttendanceAction(10, {
      meeting: identity,
      marks: { 1: 'present', 2: 'absent' },
      notes: '',
      didNotMeet: false,
    })
    expect(result.status).toBe('rejected')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('fails closed when live Rock leadership cannot be verified', async () => {
    mocks.liveAuthorize.mockResolvedValue(null)

    const result = await saveAttendanceAction(10, {
      meeting: identity,
      marks: { 1: 'present', 2: 'absent' },
      notes: '',
      didNotMeet: false,
    })

    expect(result.status).toBe('rejected')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('blocks unrecorded marks and constrains writes to the current roster', async () => {
    const result = await saveAttendanceAction(10, {
      meeting: identity,
      marks: { 1: 'present', 2: 'unrecorded', 999: 'present' },
      notes: 'Good discussion',
      didNotMeet: false,
    })
    expect(result.status).toBe('rejected')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('requires a reload when the live roster differs from the submitted roster', async () => {
    mocks.liveAuthorize.mockResolvedValue({ rosterRockPersonIds: [1, 2, 3] })

    await expect(saveAttendanceAction(10, {
      meeting: identity,
      marks: { 1: 'present', 2: 'absent' },
      notes: '',
      didNotMeet: false,
    })).resolves.toMatchObject({
      status: 'rejected',
      message: 'The group roster has changed. Reload before recording attendance.',
    })
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('uses the freshly authorized roster for a valid save', async () => {
    mocks.save.mockResolvedValue({ status: 'saved', state: { identity, notes: '', didNotMeet: false, marks: { 1: 'present', 2: 'absent' } } })
    await saveAttendanceAction(10, {
      meeting: identity,
      marks: { 1: 'present', 2: 'absent' },
      notes: '',
      didNotMeet: false,
    })
    expect(mocks.save).toHaveBeenCalledWith({
      groupId: 10,
      meeting: identity,
      roster: [{ rockPersonId: 1, state: 'present' }, { rockPersonId: 2, state: 'absent' }],
      notes: '',
      didNotMeet: false,
    })
    expect(mocks.liveAuthorize).toHaveBeenCalledWith(10, 9)
  })
})
