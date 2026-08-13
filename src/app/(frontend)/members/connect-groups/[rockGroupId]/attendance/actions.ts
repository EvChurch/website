'use server'

import {
  getConnectGroupAttendanceEntry,
  getLiveAttendanceWriteContext,
  loadConnectGroupAttendanceMeeting,
  saveConnectGroupAttendanceMeeting,
  type AttendanceMarkState,
  type AttendanceMeetingIdentity,
  type AttendanceSaveResult,
} from '@/lib/members/attendance-entry'
import { authorizeConnectGroupAttendanceLeader } from '@/lib/members/data'

interface AttendanceEditorSaveInput {
  meeting: AttendanceMeetingIdentity
  marks: Record<number, AttendanceMarkState>
  notes: string
  didNotMeet: boolean
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
  if (!isMeetingIdentity(input.meeting) || typeof input.notes !== 'string' || typeof input.didNotMeet !== 'boolean') return false
  if (!input.marks || typeof input.marks !== 'object' || Array.isArray(input.marks)) return false
  return Object.values(input.marks).every((mark) => mark === 'present' || mark === 'absent' || mark === 'unrecorded')
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
  if (!liveContext) {
    return rejected('Your current Rock leadership could not be verified. Reload before trying again.')
  }

  const canonical = await canonicalMeeting(rockGroupId, liveContext.rosterRockPersonIds, input.meeting)
  if (!canonical) return rejected('That meeting is no longer available. Reload before trying again.')

  const submittedRosterIds = Object.keys(input.marks).map(Number).filter(Number.isSafeInteger).sort((a, b) => a - b)
  if (
    submittedRosterIds.length !== liveContext.rosterRockPersonIds.length ||
    submittedRosterIds.some((personId, index) => personId !== liveContext.rosterRockPersonIds[index])
  ) {
    return rejected('The group roster has changed. Reload before recording attendance.')
  }

  const roster = liveContext.rosterRockPersonIds.map((rockPersonId) => ({
    rockPersonId,
    state: input.marks[rockPersonId],
  }))
  if (!input.didNotMeet && roster.some((person) => person.state !== 'present' && person.state !== 'absent')) {
    return rejected('Mark every person present or absent before saving.')
  }

  return saveConnectGroupAttendanceMeeting({
    groupId: rockGroupId,
    meeting: canonical,
    roster: input.didNotMeet
      ? []
      : roster.map((person) => ({
          rockPersonId: person.rockPersonId,
          state: person.state as 'present' | 'absent',
        })),
    notes: input.notes,
    didNotMeet: input.didNotMeet,
  })
}
