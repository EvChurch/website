import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ATTENDANCE_SAVE_REQUESTS_SQL } from '@/migrations/20260910_010000_attendance_save_requests'
import { orderedAttendanceSave, type AttendanceEdits } from './attendance-save-order'
import type { ConnectGroupAttendanceMeeting } from './attendance-entry'

const connectionString = process.env.ATTENDANCE_TEST_DATABASE_URL
const initial: ConnectGroupAttendanceMeeting = {
  identity: { date: '2026-08-12', startDateTime: '2026-08-12T19:00:00', scheduleId: 1, locationId: null, occurrenceId: 1 },
  marks: { 1: 'unrecorded', 2: 'unrecorded' }, notes: '', didNotMeet: false,
}

describe.skipIf(!connectionString)('attendance save ordering in PostgreSQL', () => {
  let client: Client
  let state: ConnectGroupAttendanceMeeting
  const request = (edits: AttendanceEdits, requestId = crypto.randomUUID()) => ({
    key: 'attendance:10:2026-08-12:1:', requestId, edits, connectionString,
    load: async () => state,
    write: vi.fn(async (_current: ConnectGroupAttendanceMeeting, applied: AttendanceEdits) => {
      state = { ...state, ...applied, marks: applied.didNotMeet ? { 1: 'unrecorded', 2: 'unrecorded' } : { ...state.marks, ...applied.marks } }
      return { status: 'saved' as const, state }
    }),
  })
  beforeAll(async () => {
    const url = new URL(connectionString!)
    if (!['', 'localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/attendance_autosave_test') throw new Error('Attendance tests require a local attendance_autosave_test database')
    client = new Client({ connectionString }); await client.connect()
    await client.query('DROP TABLE IF EXISTS attendance_save_requests')
    await client.query(ATTENDANCE_SAVE_REQUESTS_SQL)
  })
  beforeEach(async () => { await client.query('DELETE FROM attendance_save_requests'); state = structuredClone(initial) })
  afterAll(async () => { await client?.end() })

  it('serializes concurrent leaders, preserves unrelated edits, and prevents old replay', async () => {
    const first = request({ marks: { 1: 'absent' } })
    const second = request({ marks: { 2: 'present' } })
    await Promise.all([orderedAttendanceSave(first), orderedAttendanceSave(second)])
    expect(state.marks).toEqual({ 1: 'absent', 2: 'present' })
    await orderedAttendanceSave(request({ marks: { 1: 'present' } }))
    expect((await orderedAttendanceSave(first)).status).toBe('saved')
    expect(first.write).toHaveBeenCalledTimes(1)
    expect(state.marks[1]).toBe('present')
  })
  it('does not replay a partial or uncertain save and blocks later writes until reconciled', async () => {
    const first = request({ marks: { 1: 'absent' } })
    const uncertain = { ...first, write: vi.fn(async () => ({ status: 'outcome-unknown' as const, message: 'Timeout' })) }
    expect((await orderedAttendanceSave(uncertain)).status).toBe('outcome-unknown')
    expect((await orderedAttendanceSave(uncertain)).status).toBe('outcome-unknown')
    const later = request({ notes: 'Other leader', marks: {} })
    expect((await orderedAttendanceSave(later)).status).toBe('outcome-unknown')
    expect(later.write).not.toHaveBeenCalled()
    expect(uncertain.write).toHaveBeenCalledTimes(1)
    state.marks[1] = 'absent'
    expect((await orderedAttendanceSave(uncertain)).status).toBe('saved')
    expect((await orderedAttendanceSave(later)).status).toBe('saved')
  })
  it('resumes a known-settled partial write before accepting newer edits', async () => {
    const first = request({ marks: { 1: 'absent', 2: 'present' } })
    const partial = { ...first, write: vi.fn(async () => {
      state.marks[1] = 'absent'
      return { status: 'outcome-unknown' as const, retrySafe: true, message: 'Read failed after a completed write' }
    }) }
    await orderedAttendanceSave(partial)
    const later = request({ marks: { 1: 'present' }, notes: 'Latest' })
    expect((await orderedAttendanceSave(later)).status).toBe('saved')
    expect(state.marks).toEqual({ 1: 'present', 2: 'present' })
    expect(later.write).toHaveBeenCalledTimes(2)
    expect((await orderedAttendanceSave({ ...first, recoveryOnly: true })).status).toBe('saved')
    expect(first.write).not.toHaveBeenCalled()
  })
  it('does not replay an unjournaled retry after another leader saves', async () => {
    const old = request({ marks: { 1: 'absent' } })
    await orderedAttendanceSave(request({ marks: { 1: 'present' } }))
    expect((await orderedAttendanceSave({ ...old, recoveryOnly: true })).status).toBe('rejected')
    expect(old.write).not.toHaveBeenCalled()
    expect(state.marks[1]).toBe('present')
  })
  it('checks cancellation cleared all attendance before resolving an uncertain result', async () => {
    state.marks[1] = 'present'
    const cancel = request({ marks: {}, didNotMeet: true, confirmClear: true })
    const uncertain = { ...cancel, write: async () => {
      state.didNotMeet = true
      return { status: 'outcome-unknown' as const, message: 'Timeout' }
    } }
    await orderedAttendanceSave(uncertain)
    expect((await orderedAttendanceSave(uncertain)).status).toBe('outcome-unknown')
    state.marks[1] = 'unrecorded'
    expect((await orderedAttendanceSave(uncertain)).status).toBe('saved')
  })
  it('requires confirmation for recorded attendance and rejects stale marks after cancellation', async () => {
    state.marks[1] = 'present'
    expect((await orderedAttendanceSave(request({ marks: {}, didNotMeet: true }))).status).toBe('rejected')
    await orderedAttendanceSave(request({ marks: {}, didNotMeet: true, confirmClear: true }))
    expect((await orderedAttendanceSave(request({ marks: { 2: 'present' } }))).status).toBe('rejected')
    await orderedAttendanceSave(request({ marks: {}, didNotMeet: false }))
    expect(state.marks).toEqual({ 1: 'unrecorded', 2: 'unrecorded' })
  })
  it('rejects reuse of an id for changed edits or a different meeting', async () => {
    const original = request({ marks: { 1: 'present' } })
    await orderedAttendanceSave(original)
    expect((await orderedAttendanceSave({ ...original, edits: { marks: { 1: 'absent' } } })).status).toBe('rejected')
    expect((await orderedAttendanceSave({ ...original, key: 'other' })).status).toBe('rejected')
  })
})
