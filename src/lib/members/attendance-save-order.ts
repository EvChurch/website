import { createHash } from 'node:crypto'
import { Client } from 'pg'
import type { AttendanceMarkState, AttendanceSaveResult, ConnectGroupAttendanceMeeting } from './attendance-entry'

export interface AttendanceEdits {
  marks: Record<number, 'present' | 'absent'>
  notes?: string
  didNotMeet?: boolean
  confirmClear?: boolean
}

type SaveTarget = Omit<AttendanceEdits, 'marks'> & { marks: Record<number, AttendanceMarkState> }

function matches(state: ConnectGroupAttendanceMeeting, target: SaveTarget) {
  return (target.notes === undefined || state.notes === target.notes.trim()) &&
    (target.didNotMeet === undefined || state.didNotMeet === target.didNotMeet) &&
    Object.entries(target.marks).every(([id, mark]) => state.marks[Number(id)] === mark)
}

// The session lock covers Rock reads and writes across all application instances.
// A durable pending row survives process failure and blocks blind replay of a mutation.
export async function orderedAttendanceSave(input: {
  key: string
  requestId: string
  connectionString?: string
  recoveryOnly?: boolean
  edits: AttendanceEdits
  load: () => Promise<ConnectGroupAttendanceMeeting>
  write: (state: ConnectGroupAttendanceMeeting, edits: AttendanceEdits) => Promise<AttendanceSaveResult>
}): Promise<AttendanceSaveResult> {
  const client = new Client({ connectionString: input.connectionString ?? process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [input.key])
    const fingerprint = createHash('sha256').update(JSON.stringify(input.edits)).digest('hex')
    const previous = await client.query<{ fingerprint: string; completed: boolean; meeting_key: string }>(
      'SELECT fingerprint, completed, meeting_key FROM attendance_save_requests WHERE request_id = $1', [input.requestId],
    )
    if (previous.rows[0] && (previous.rows[0].fingerprint !== fingerprint || previous.rows[0].meeting_key !== input.key)) {
      return { status: 'rejected', message: 'This save request has changed. Reload before trying again.' }
    }
    if (input.recoveryOnly && !previous.rows.length) return { status: 'rejected', message: 'This save did not start. Retry to apply your latest changes.' }
    let current = await input.load()
    const pending = await client.query<{ request_id: string; target: SaveTarget; retry_safe: boolean }>(
      'SELECT request_id, target, retry_safe FROM attendance_save_requests WHERE meeting_key = $1 AND NOT completed', [input.key],
    )
    for (const row of pending.rows) {
      if (!matches(current, row.target) && row.retry_safe) {
        const edits: AttendanceEdits = { ...row.target, marks: Object.fromEntries(Object.entries(row.target.marks).filter((entry): entry is [string, 'present' | 'absent'] => entry[1] !== 'unrecorded')) }
        const result = await input.write(current, edits)
        await client.query('UPDATE attendance_save_requests SET retry_safe = $2 WHERE request_id = $1', [row.request_id, result.status === 'saved' || result.status === 'rejected' || result.retrySafe === true])
        if (result.status !== 'saved') return result
        current = result.state
      }
      if (!matches(current, row.target)) {
        return { status: 'outcome-unknown', message: 'Some attendance may have saved. Check save status before continuing. If this persists, ask the website team to check Rock.' }
      }
      await client.query('UPDATE attendance_save_requests SET completed = true WHERE request_id = $1', [row.request_id])
    }
    if (previous.rows.length) return { status: 'saved', state: current }
    if (input.edits.didNotMeet === true && !input.edits.confirmClear && Object.values(current.marks).some(mark => mark !== 'unrecorded')) {
      return { status: 'rejected', message: 'Attendance has been recorded. Confirm clearing it by selecting “Group did not meet” again.' }
    }
    // Attendance edits cannot silently reverse a cancellation saved by another leader.
    if (current.didNotMeet && input.edits.didNotMeet === undefined && Object.keys(input.edits.marks).length) {
      return { status: 'rejected', message: 'This meeting is marked as not held. Reload before recording attendance.' }
    }
    const target: SaveTarget = input.edits.didNotMeet === true
      ? { ...input.edits, marks: Object.fromEntries(Object.keys(current.marks).map(id => [id, 'unrecorded' as const])) }
      : input.edits
    await client.query('INSERT INTO attendance_save_requests (request_id, meeting_key, fingerprint, target) VALUES ($1, $2, $3, $4)',
      [input.requestId, input.key, fingerprint, JSON.stringify(target)])
    const result = await input.write(current, input.edits)
    if (result.status !== 'saved' && result.retrySafe) await client.query('UPDATE attendance_save_requests SET retry_safe = true WHERE request_id = $1', [input.requestId])
    if (result.status === 'rejected') {
      await client.query('DELETE FROM attendance_save_requests WHERE request_id = $1', [input.requestId])
    }
    if (result.status === 'saved' && !matches(result.state, target)) {
      return { status: 'outcome-unknown', message: 'The saved result does not yet match your changes. Check save status before continuing.' }
    }
    if (result.status === 'saved') {
      await client.query('UPDATE attendance_save_requests SET completed = true WHERE request_id = $1', [input.requestId])
    }
    return result
  } finally {
    // Closing the dedicated session also releases the advisory lock on exceptions.
    await client.end()
  }
}
