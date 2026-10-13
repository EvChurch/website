import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), liveAuthorize: vi.fn(), load: vi.fn(), save: vi.fn(), entry: vi.fn(), ordered: vi.fn() }))
vi.mock('@/lib/members/data', () => ({ authorizeConnectGroupAttendanceLeader: mocks.authorize }))
vi.mock('@/lib/members/attendance-entry', () => ({
  getConnectGroupAttendanceEntry: mocks.entry, getLiveAttendanceWriteContext: mocks.liveAuthorize,
  loadConnectGroupAttendanceMeeting: mocks.load, saveConnectGroupAttendanceMeeting: mocks.save,
}))
vi.mock('@/lib/members/attendance-save-order', () => ({ orderedAttendanceSave: mocks.ordered }))
import { loadAttendanceMeetingAction, saveAttendanceAction } from './actions'
import type { ConnectGroupAttendanceMeeting } from '@/lib/members/attendance-entry'

const identity = { date: '2026-08-12', startDateTime: '2026-08-12T19:00:00+12:00', scheduleId: 8, locationId: 3, occurrenceId: 44 }
const current: ConnectGroupAttendanceMeeting = { identity, notes: 'Existing', didNotMeet: false, marks: { 1: 'unrecorded', 2: 'absent' } }
const input = { meeting: identity, requestId: '00000000-0000-4000-8000-000000000001', rosterIds: [1, 2], edits: { marks: {}, notes: 'New note' } }

describe('attendance actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.authorize.mockResolvedValue({ access: 'granted', people: [{ rockPersonId: 1 }, { rockPersonId: 2 }], actorRockPersonId: 9 })
    mocks.liveAuthorize.mockResolvedValue({ rosterRockPersonIds: [1, 2] })
    mocks.entry.mockResolvedValue({ meetings: [identity] })
    mocks.load.mockResolvedValue(current)
    mocks.ordered.mockImplementation(async ({ load, write, edits }) => write(await load(), edits))
  })
  it('reauthorizes meeting loads', async () => {
    await loadAttendanceMeetingAction(10, identity)
    expect(mocks.authorize).toHaveBeenCalledWith(10)
    expect(mocks.load).toHaveBeenCalledWith(10, identity, [1, 2])
  })
  it.each([
    { ...input, requestId: 'bad' },
    { ...input, edits: { marks: { 1: 'unrecorded' } } },
    { ...input, edits: { marks: {}, didNotMeet: 'yes' } },
  ])('rejects invalid input without authorizing or writing', async invalid => {
    expect(await saveAttendanceAction(10, invalid)).toMatchObject({ status: 'rejected' })
    expect(mocks.authorize).not.toHaveBeenCalled()
  })
  it('rejects expired leadership', async () => {
    mocks.authorize.mockResolvedValue({ access: 'denied' })
    expect(await saveAttendanceAction(10, input)).toMatchObject({ status: 'rejected' })
    expect(mocks.ordered).not.toHaveBeenCalled()
  })
  it('rejects missing live leadership', async () => {
    mocks.liveAuthorize.mockResolvedValue(null)
    expect(await saveAttendanceAction(10, input)).toMatchObject({ status: 'rejected' })
    expect(mocks.ordered).not.toHaveBeenCalled()
  })
  it('rejects an unavailable meeting', async () => {
    mocks.entry.mockResolvedValue({ meetings: [] })
    expect(await saveAttendanceAction(10, input)).toMatchObject({ status: 'rejected' })
  })
  it('rejects a changed live roster and foreign person IDs', async () => {
    expect(await saveAttendanceAction(10, { ...input, rosterIds: [1] })).toMatchObject({ status: 'rejected' })
    expect(await saveAttendanceAction(10, { ...input, edits: { marks: { 99: 'present' } } })).toMatchObject({ status: 'rejected' })
    expect(mocks.ordered).not.toHaveBeenCalled()
  })
  it('saves notes without confirming any marks or changing meeting status', async () => {
    await saveAttendanceAction(10, input)
    expect(mocks.save).toHaveBeenCalledWith({
      groupId: 10, meeting: identity,
      roster: [{ rockPersonId: 1, state: 'unrecorded' }, { rockPersonId: 2, state: 'absent' }],
      notes: 'New note', didNotMeet: false, changedPersonIds: [], writeNotes: true, writeDidNotMeet: false,
    })
  })
  it('saves only changed marks using the current canonical notes', async () => {
    await saveAttendanceAction(10, { ...input, edits: { marks: { 1: 'present' } } })
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ changedPersonIds: [1], notes: 'Existing', writeNotes: false }))
  })
  it('allows cancellation with unrecorded marks', async () => {
    await saveAttendanceAction(10, { ...input, edits: { marks: {}, didNotMeet: true, confirmClear: true } })
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ didNotMeet: true, writeDidNotMeet: true }))
  })
})
