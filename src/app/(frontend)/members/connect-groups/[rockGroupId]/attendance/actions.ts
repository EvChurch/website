'use server'

import { orderedAttendanceSave, type AttendanceEdits } from '@/lib/members/attendance-save-order'

import {
  getConnectGroupAttendanceEntry,
  getLiveAttendanceWriteContext,
  loadConnectGroupAttendanceMeeting,
  saveConnectGroupAttendanceMeeting,
  type AttendanceMeetingIdentity,
  type AttendanceSaveResult,
} from '@/lib/members/attendance-entry'
import { authorizeConnectGroupAttendanceLeader } from '@/lib/members/data'

interface AttendanceEditorSaveInput {
  meeting: AttendanceMeetingIdentity
  requestId: string
  recoveryOnly?: boolean
  rosterIds: number[]
  edits: AttendanceEdits
}

function isMeetingIdentity(value: unknown): value is AttendanceMeetingIdentity {
  if (!value || typeof value !== 'object') return false
  const meeting = value as Partial<AttendanceMeetingIdentity>
  return /^\d{4}-\d{2}-\d{2}$/u.test(meeting.date ?? '') &&
    typeof meeting.startDateTime === 'string' &&
    Number.isSafeInteger(meeting.scheduleId) && (meeting.scheduleId ?? 0) > 0 &&
    (meeting.locationId === null || (Number.isSafeInteger(meeting.locationId) && (meeting.locationId ?? 0) > 0)) &&
    (meeting.occurrenceId === null || (Number.isSafeInteger(meeting.occurrenceId) && (meeting.occurrenceId ?? 0) > 0))
}

function isSaveInput(value: unknown): value is AttendanceEditorSaveInput {
  if (!value || typeof value !== 'object') return false
  const input = value as Partial<AttendanceEditorSaveInput>
  if (!isMeetingIdentity(input.meeting) || typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(input.requestId)) return false
  if (!Array.isArray(input.rosterIds) || !input.rosterIds.every(id => Number.isSafeInteger(id) && id > 0)) return false
  if (input.recoveryOnly !== undefined && typeof input.recoveryOnly !== 'boolean') return false
  const edits = input.edits
  if (!edits || typeof edits !== 'object' || !edits.marks || typeof edits.marks !== 'object' || Array.isArray(edits.marks)) return false
  if (edits.notes !== undefined && typeof edits.notes !== 'string') return false
  if (edits.didNotMeet !== undefined && typeof edits.didNotMeet !== 'boolean') return false
  if (edits.confirmClear !== undefined && typeof edits.confirmClear !== 'boolean') return false
  return Object.entries(edits.marks).every(([id, mark]) => Number.isSafeInteger(Number(id)) && Number(id) > 0 && (mark === 'present' || mark === 'absent'))
}

function sameScheduledMeeting(left: AttendanceMeetingIdentity, right: AttendanceMeetingIdentity) {
  return left.date === right.date && left.scheduleId === right.scheduleId && left.locationId === right.locationId
}

async function canonicalMeeting(groupId: number, rosterIds: number[], requested: AttendanceMeetingIdentity) {
  const entry = await getConnectGroupAttendanceEntry(groupId, rosterIds)
  return entry.meetings.find((meeting) => sameScheduledMeeting(meeting, requested)) ?? null
}

const rejected = (message: string): AttendanceSaveResult => ({ status: 'rejected', message })

export async function loadAttendanceMeetingAction(
  rockGroupId: number,
  meeting: AttendanceMeetingIdentity,
) {
  const context = await authorizeConnectGroupAttendanceLeader(rockGroupId)
  if (!context || context.access !== 'granted') return null
  if (!isMeetingIdentity(meeting)) return null
  const rosterIds = context.people.map((person) => person.rockPersonId)
  const canonical = await canonicalMeeting(rockGroupId, rosterIds, meeting)
  if (!canonical) return null
  return loadConnectGroupAttendanceMeeting(
    rockGroupId,
    canonical,
    rosterIds,
  )
}

export async function saveAttendanceAction(
  rockGroupId: number,
  input: unknown,
): Promise<AttendanceSaveResult> {
  if (!Number.isSafeInteger(rockGroupId) || rockGroupId <= 0 || !isSaveInput(input)) {
    return rejected('The attendance save was invalid.')
  }
  const context = await authorizeConnectGroupAttendanceLeader(rockGroupId)
  if (!context || context.access !== 'granted') {
    return rejected('You no longer have permission to record attendance for this group.')
  }

  const liveContext = await getLiveAttendanceWriteContext(
    rockGroupId,
    context.actorRockPersonId,
  )
  if (!liveContext) return rejected('Your current Rock leadership could not be verified. Reload before trying again.')

  const canonical = await canonicalMeeting(rockGroupId, liveContext.rosterRockPersonIds, input.meeting)
  if (!canonical) return rejected('That meeting is no longer available. Reload before trying again.')

  const submittedRosterIds = [...input.rosterIds].sort((a, b) => a - b)
  if (
    submittedRosterIds.length !== liveContext.rosterRockPersonIds.length ||
    submittedRosterIds.some((personId, index) => personId !== liveContext.rosterRockPersonIds[index])
  ) {
    return rejected('The group roster has changed. Reload before recording attendance.')
  }

  if (Object.keys(input.edits.marks).some(id => !liveContext.rosterRockPersonIds.includes(Number(id)))) {
    return rejected('The attendance save was invalid.')
  }
  if (input.edits.notes !== undefined && input.edits.notes.trim().length > 2000) return rejected('Notes must be 2000 characters or fewer.')
  return orderedAttendanceSave({
    key: `attendance:${rockGroupId}:${canonical.date}:${canonical.scheduleId}:${canonical.locationId ?? ''}`,
    requestId: input.requestId,
    edits: input.edits,
    recoveryOnly: input.recoveryOnly,
    load: () => loadConnectGroupAttendanceMeeting(rockGroupId, canonical, liveContext.rosterRockPersonIds),
    write: async (current, edits) => {
      try {
        const actor = await authorizeConnectGroupAttendanceLeader(rockGroupId)
        if (!actor || actor.access !== 'granted') return rejected('You no longer have permission to record attendance for this group.')
        const live = await getLiveAttendanceWriteContext(rockGroupId, actor.actorRockPersonId)
        if (!live || live.rosterRockPersonIds.join(',') !== liveContext.rosterRockPersonIds.join(',') || Object.keys(edits.marks).some(id => !live.rosterRockPersonIds.includes(Number(id)))) {
          return rejected('Your leadership or the group roster has changed. Reload before recording attendance.')
        }
      } catch {
        return rejected('Your current leadership could not be verified. Retry when the connection is available.')
      }
      return saveConnectGroupAttendanceMeeting({
      groupId: rockGroupId,
      meeting: canonical,
      roster: liveContext.rosterRockPersonIds.map(rockPersonId => ({
        rockPersonId,
        state: edits.marks[rockPersonId] ?? current.marks[rockPersonId] ?? 'unrecorded',
      })),
      notes: edits.notes ?? current.notes,
      didNotMeet: edits.didNotMeet ?? current.didNotMeet,
      changedPersonIds: Object.keys(edits.marks).map(Number),
      writeNotes: edits.notes !== undefined,
      writeDidNotMeet: edits.didNotMeet !== undefined,
      })
    },
  })
}
