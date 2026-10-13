import type { AttendanceSaveResult, ConnectGroupAttendanceMeeting } from '@/lib/members/attendance-entry'
import type { AttendanceEdits } from '@/lib/members/attendance-save-order'

type Request = { requestId: string; recoveryOnly?: boolean; edits: AttendanceEdits }
const empty = (): AttendanceEdits => ({ marks: {} })
const hasEdits = (edits: AttendanceEdits) => Object.keys(edits.marks).length > 0 || edits.notes !== undefined || edits.didNotMeet !== undefined
const merge = (older: AttendanceEdits, newer: AttendanceEdits): AttendanceEdits => ({ ...older, ...newer, marks: { ...older.marks, ...newer.marks } })

export class AttendanceAutosave {
  meeting: ConnectGroupAttendanceMeeting
  pending = empty()
  failed: Request | null = null
  message: string | null = null
  uncertain = false
  saving = false
  saved = false
  private running: Promise<boolean> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private retries = 0
  private notesReadyAt = 0
  private forceNotes = false

  constructor(meeting: ConnectGroupAttendanceMeeting, private send: (request: Request) => Promise<AttendanceSaveResult>, private notify: () => void) {
    this.meeting = meeting
  }

  get dirty() { return hasEdits(this.pending) || this.saving || this.failed !== null }

  edit(edits: AttendanceEdits, delay = 0) {
    this.pending = merge(this.pending, edits)
    if (edits.didNotMeet === true) this.pending.marks = {}
    this.meeting = { ...this.meeting, ...edits, marks: { ...this.meeting.marks, ...edits.marks } }
    this.saved = false
    if (edits.notes !== undefined) this.notesReadyAt = Date.now() + delay
    clearTimeout(this.timer)
    this.notify()
    if (!this.failed) this.timer = setTimeout(() => { void this.flush(false) }, delay)
  }

  activate() { this.disposed = false }

  dispose() { this.disposed = true; clearTimeout(this.timer) }

  flush(flushNotes = true): Promise<boolean> {
    this.forceNotes ||= flushNotes
    clearTimeout(this.timer)
    if (this.running) return this.running
    if (this.failed || this.disposed) return Promise.resolve(false)
    this.running = this.drain().finally(() => { this.running = null; this.forceNotes = false })
    return this.running
  }

  async retry(flushNotes = true): Promise<boolean> {
    this.forceNotes ||= flushNotes
    clearTimeout(this.timer)
    if (this.running) return this.running
    const failed = this.failed
    if (!failed) return this.flush()
    this.failed = null
    if (!this.uncertain) {
      failed.edits = merge(failed.edits, this.pending)
      this.pending = empty()
    }
    this.running = this.drain(this.uncertain ? { ...failed, recoveryOnly: true } : { requestId: crypto.randomUUID(), edits: failed.edits }).finally(() => { this.running = null; this.forceNotes = false })
    return this.running
  }

  private async drain(first?: Request): Promise<boolean> {
    let request = first
    while (!this.disposed && (request || hasEdits(this.pending))) {
      if (!request) {
        const edits = this.pending
        this.pending = empty()
        if (edits.notes !== undefined && !this.forceNotes && Date.now() < this.notesReadyAt) {
          this.pending.notes = edits.notes
          delete edits.notes
        }
        if (!hasEdits(edits)) {
          this.timer = setTimeout(() => { void this.flush(false) }, Math.max(0, this.notesReadyAt - Date.now()))
          break
        }
        request = { requestId: crypto.randomUUID(), edits }
      }
      this.saving = true
      this.message = null
      this.notify()
      let result: AttendanceSaveResult
      try { result = await this.send(request) }
      catch { result = { status: 'outcome-unknown', message: 'The save could not be confirmed. Check save status before continuing.' } }
      this.saving = false
      if (this.disposed) return false
      if (result.status !== 'saved') {
        this.failed = request
        this.uncertain = result.status !== 'rejected'
        this.message = result.message
        this.notify()
        if (this.uncertain && this.retries < 3) {
          const delay = 1000 * 2 ** this.retries++
          this.timer = setTimeout(() => { void this.retry(false) }, delay)
        }
        return false
      }
      this.retries = 0
      this.uncertain = false
      this.meeting = {
        ...result.state,
        ...this.pending,
        marks: { ...result.state.marks, ...this.pending.marks },
      }
      this.saved = true
      request = undefined
      this.notify()
    }
    return !this.disposed
  }
}
