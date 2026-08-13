import { rockFetch, rockFetchAll, RockAPIError } from '@/lib/rock-api'

const REQUEST = { retries: 0, timeoutMs: 8_000 } as const
const NOTES_LIMIT = 2000

export type AttendanceMarkState = 'present' | 'absent' | 'unrecorded'

export interface AttendanceMeetingIdentity {
  date: string
  startDateTime: string
  scheduleId: number
  locationId: number | null
  occurrenceId: number | null
}

export interface ConnectGroupAttendanceMeeting {
  identity: AttendanceMeetingIdentity
  notes: string
  didNotMeet: boolean
  marks: Record<number, AttendanceMarkState>
}

export interface ConnectGroupAttendanceEntry {
  meetings: AttendanceMeetingIdentity[]
  selectedMeeting: ConnectGroupAttendanceMeeting | null
}

export interface AttendanceSaveInput {
  groupId: number
  meeting: AttendanceMeetingIdentity
  roster: Array<{ rockPersonId: number; state: Exclude<AttendanceMarkState, 'unrecorded'> }>
  notes: string
  didNotMeet: boolean
}

export type AttendanceSaveResult =
  | { status: 'saved'; state: ConnectGroupAttendanceMeeting }
  | { status: 'rejected' | 'outcome-unknown' | 'read-back-failed'; message: string }

interface RockGroupSchedule {
  Id: number
  WeeklyDayOfWeek?: number | null
  WeeklyTimeOfDay?: string | null
  IsActive?: boolean | null
  EffectiveStartDate?: string | null
  EffectiveEndDate?: string | null
}

interface RockGroupLocation {
  LocationId?: number | null
  Schedules?: RockGroupSchedule[] | null
}

interface RockGroupWithSchedules {
  Id: number
  ScheduleId?: number | null
  Schedule?: RockGroupSchedule | null
  GroupLocations?: RockGroupLocation[] | null
}

interface RockOccurrence {
  Id: number
  GroupId?: number | null
  LocationId?: number | null
  ScheduleId?: number | null
  OccurrenceDate?: string | null
  DidNotOccur?: boolean | null
  Notes?: string | null
}

interface RockAttendance {
  Id: number
  OccurrenceId: number
  PersonAliasId?: number | null
  DidAttend?: boolean | null
  StartDateTime?: string | null
}

interface RockPersonAlias {
  Id: number
  PersonId?: number | null
}

interface RockAttendanceGroupMember {
  Id?: number
  GroupId?: number
  Person?: { Id: number }
  GroupRole?: { IsLeader?: boolean | null }
  GroupMemberStatus?: number | null
  IsArchived?: boolean | null
}

export interface LiveAttendanceWriteContext { rosterRockPersonIds: number[] }

function positive(value: number | null | undefined): value is number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0
}

function validGroupId(groupId: number) {
  if (!positive(groupId)) throw new Error('Attendance entry requires a durable group Id')
}

function dateKey(value: string | null | undefined): string | null {
  const candidate = value?.slice(0, 10)
  return candidate && /^\d{4}-\d{2}-\d{2}$/u.test(candidate) ? candidate : null
}

function aucklandDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

function previousWeekday(today: string, weekday: number, offset: number) {
  const noon = new Date(`${today}T12:00:00+12:00`)
  const daysBack = (noon.getUTCDay() - weekday + 7) % 7 + offset * 7
  noon.setUTCDate(noon.getUTCDate() - daysBack)
  return noon.toISOString().slice(0, 10)
}

function meetingKey(meeting: Pick<AttendanceMeetingIdentity, 'date' | 'scheduleId' | 'locationId'>) {
  return `${meeting.date}:${meeting.scheduleId}:${meeting.locationId ?? 'none'}`
}

export function buildRecentScheduledMeetings({
  group, occurrences, now = new Date(),
}: { group: RockGroupWithSchedules; occurrences: RockOccurrence[]; now?: Date }): AttendanceMeetingIdentity[] {
  const today = aucklandDate(now)
  const schedules: Array<{ schedule: RockGroupSchedule; locationId: number | null }> = []
  if (group.Schedule && positive(group.Schedule.Id)) schedules.push({ schedule: group.Schedule, locationId: null })
  for (const location of group.GroupLocations ?? []) {
    for (const schedule of location.Schedules ?? []) {
      if (positive(schedule.Id)) schedules.push({ schedule, locationId: positive(location.LocationId) ? location.LocationId : null })
    }
  }
  const candidates = new Map<string, AttendanceMeetingIdentity>()
  const schedulesById = new Map(schedules.map((item) => [item.schedule.Id, item]))
  for (const { schedule, locationId } of schedules) {
    if (schedule.IsActive === false || schedule.WeeklyDayOfWeek == null) continue
    for (let offset = 0; offset < 8; offset++) {
      const date = previousWeekday(today, schedule.WeeklyDayOfWeek, offset)
      const effectiveStart = dateKey(schedule.EffectiveStartDate)
      const effectiveEnd = dateKey(schedule.EffectiveEndDate)
      if ((effectiveStart && date < effectiveStart) || (effectiveEnd && date > effectiveEnd)) continue
      const time = schedule.WeeklyTimeOfDay?.slice(0, 8) || '00:00:00'
      const identity = { date, startDateTime: `${date}T${time}`, scheduleId: schedule.Id, locationId, occurrenceId: null }
      candidates.set(meetingKey(identity), identity)
    }
  }
  for (const occurrence of occurrences) {
    const date = dateKey(occurrence.OccurrenceDate)
    if (!date || date > today || !positive(occurrence.ScheduleId)) continue
    const scheduled = schedulesById.get(occurrence.ScheduleId)
    if (!scheduled || scheduled.locationId !== (positive(occurrence.LocationId) ? occurrence.LocationId : null)) continue
    const time = scheduled.schedule.WeeklyTimeOfDay?.slice(0, 8) || '00:00:00'
    const identity = {
      date, startDateTime: `${date}T${time}`, scheduleId: occurrence.ScheduleId,
      locationId: positive(occurrence.LocationId) ? occurrence.LocationId : null,
      occurrenceId: occurrence.Id,
    }
    candidates.set(meetingKey(identity), identity)
  }
  const result = [...candidates.values()].sort((a, b) =>
    b.date.localeCompare(a.date) || b.scheduleId - a.scheduleId || (b.locationId ?? 0) - (a.locationId ?? 0),
  ).slice(0, 4)
  if (result.length === 0) throw new Error('Rock did not provide an unambiguous active weekly schedule')
  return result
}

async function fetchGroupSchedules(groupId: number) {
  const groups = await rockFetchAll<RockGroupWithSchedules>({
    endpoint: 'Groups', getKey: (group) => group.Id,
    params: {
      $filter: `Id eq ${groupId} and IsActive eq true`,
      $expand: 'Schedule,GroupLocations/Schedules',
    }, ...REQUEST,
  })
  if (groups.length !== 1) throw new Error('Rock did not return one active Connect Group')
  return groups[0]
}

async function fetchOccurrences(groupId: number, start: string, end: string) {
  return rockFetchAll<RockOccurrence>({
    endpoint: 'AttendanceOccurrences', getKey: (item) => item.Id,
    params: {
      $filter: `GroupId eq ${groupId} and OccurrenceDate ge datetime'${start}T00:00:00' and OccurrenceDate le datetime'${end}T23:59:59'`,
      $orderby: 'OccurrenceDate desc,Id desc',
      $select: 'Id,GroupId,LocationId,ScheduleId,OccurrenceDate,DidNotOccur,Notes',
    }, ...REQUEST,
  })
}

async function aliasesByPerson(personIds: number[]) {
  if (personIds.length === 0) return new Map<number, number>()
  const filter = personIds.map((id) => `Id eq ${id}`).join(' or ')
  const people = await rockFetchAll<{ Id: number; PrimaryAliasId?: number | null }>({
    endpoint: 'People', getKey: (person) => person.Id,
    params: { $filter: `(${filter})`, $orderby: 'Id', $select: 'Id,PrimaryAliasId' },
    ...REQUEST,
  })
  const result = new Map(people.flatMap((person) =>
    positive(person.PrimaryAliasId) ? [[person.Id, person.PrimaryAliasId] as const] : [],
  ))
  if (result.size !== personIds.length) throw new Error('Rock did not return a primary alias for every roster person')
  return result
}

async function peopleByAlias(aliasIds: number[]) {
  if (aliasIds.length === 0) return new Map<number, number>()
  const filter = aliasIds.map((id) => `Id eq ${id}`).join(' or ')
  const aliases = await rockFetchAll<RockPersonAlias>({
    endpoint: 'PersonAlias', getKey: (alias) => alias.Id,
    params: { $filter: `(${filter})`, $orderby: 'Id', $select: 'Id,PersonId' },
    ...REQUEST,
  })
  return new Map(aliases.flatMap((alias) =>
    positive(alias.PersonId) ? [[alias.Id, alias.PersonId] as const] : [],
  ))
}

async function loadMeeting(groupId: number, identity: AttendanceMeetingIdentity, rosterIds: number[]) {
  const matches = await fetchOccurrences(groupId, identity.date, identity.date)
  const canonical = matches.filter((item) =>
    item.ScheduleId === identity.scheduleId && (item.LocationId ?? null) === identity.locationId,
  )
  if (canonical.length > 1) throw new Error('Rock returned ambiguous attendance occurrences')
  const occurrence = canonical[0]
  const marks = Object.fromEntries(rosterIds.map((id) => [id, occurrence ? 'unrecorded' : 'present'])) as Record<number, AttendanceMarkState>
  if (!occurrence) return { identity: { ...identity, occurrenceId: null }, notes: '', didNotMeet: false, marks }
  const aliases = await aliasesByPerson(rosterIds)
  const aliasToPerson = new Map([...aliases].map(([person, alias]) => [alias, person]))
  const attendances = await rockFetchAll<RockAttendance>({
    endpoint: 'Attendances', getKey: (item) => item.Id,
    params: {
      $filter: `OccurrenceId eq ${occurrence.Id}`,
      $orderby: 'Id',
      $select: 'Id,OccurrenceId,PersonAliasId,DidAttend,StartDateTime',
    },
    ...REQUEST,
  })
  const unknownAliases = await peopleByAlias([...new Set(attendances.flatMap((attendance) =>
    positive(attendance.PersonAliasId) && !aliasToPerson.has(attendance.PersonAliasId)
      ? [attendance.PersonAliasId]
      : [],
  ))])
  for (const attendance of attendances) {
    const person = positive(attendance.PersonAliasId)
      ? aliasToPerson.get(attendance.PersonAliasId) ?? unknownAliases.get(attendance.PersonAliasId)
      : null
    if (person) marks[person] = attendance.DidAttend == null ? 'unrecorded' : attendance.DidAttend ? 'present' : 'absent'
  }
  return {
    identity: { ...identity, occurrenceId: occurrence.Id }, notes: occurrence.Notes ?? '',
    didNotMeet: occurrence.DidNotOccur === true, marks,
  }
}

export async function loadConnectGroupAttendanceMeeting(
  groupId: number, identity: AttendanceMeetingIdentity, rosterIds: number[],
): Promise<ConnectGroupAttendanceMeeting> {
  validGroupId(groupId)
  return loadMeeting(groupId, identity, [...new Set(rosterIds)].filter(positive))
}

export async function getConnectGroupAttendanceEntry(
  groupId: number, rosterIds: number[], now = new Date(),
): Promise<ConnectGroupAttendanceEntry> {
  validGroupId(groupId)
  const today = aucklandDate(now)
  const start = new Date(`${today}T12:00:00+12:00`)
  start.setUTCDate(start.getUTCDate() - 70)
  const [group, occurrences] = await Promise.all([
    fetchGroupSchedules(groupId), fetchOccurrences(groupId, start.toISOString().slice(0, 10), today),
  ])
  const meetings = buildRecentScheduledMeetings({ group, occurrences, now })
  return { meetings, selectedMeeting: await loadMeeting(groupId, meetings[0], [...new Set(rosterIds)].filter(positive)) }
}

export async function getLiveAttendanceWriteContext(
  groupId: number,
  actorRockPersonId: number,
): Promise<LiveAttendanceWriteContext | null> {
  validGroupId(groupId)
  if (!positive(actorRockPersonId)) return null
  const groups = await rockFetchAll<RockGroupWithSchedules & { Members?: RockAttendanceGroupMember[] }>({
    endpoint: 'Groups',
    getKey: (group) => group.Id,
    params: {
      $filter: `Id eq ${groupId} and IsActive eq true`,
      $expand: 'Members($expand=Person,GroupRole)',
      $select: 'Id',
    },
    ...REQUEST,
  })
  if (groups.length !== 1) return null
  const members = (groups[0].Members ?? []).filter((member) =>
    member.GroupId === groupId && positive(member.Id) && positive(member.Person?.Id) &&
    member.GroupMemberStatus === 1 && member.IsArchived === false,
  )
  const actor = members.find((member) => member.Person?.Id === actorRockPersonId)
  if (actor?.GroupRole?.IsLeader !== true) return null
  return {
    rosterRockPersonIds: [...new Set(members.map((member) => member.Person!.Id))].sort((a, b) => a - b),
  }
}

function mutationOutcomeUnknown(error: unknown) {
  return !(error instanceof RockAPIError) || error.status >= 500 || error.status === 429
}

async function mutate<T>(endpoint: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return rockFetch<T>({ endpoint, method, body, ...REQUEST })
}

export async function saveConnectGroupAttendanceMeeting(input: AttendanceSaveInput): Promise<AttendanceSaveResult> {
  validGroupId(input.groupId)
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(input.meeting.date) ||
    !positive(input.meeting.scheduleId) ||
    (input.meeting.locationId !== null && !positive(input.meeting.locationId)) ||
    input.roster.some((row) => !positive(row.rockPersonId) || (row.state !== 'present' && row.state !== 'absent')) ||
    new Set(input.roster.map((row) => row.rockPersonId)).size !== input.roster.length
  ) {
    return { status: 'rejected', message: 'The attendance save was invalid.' }
  }
  const notes = input.notes.trim()
  if (notes.length > NOTES_LIMIT) return { status: 'rejected', message: `Notes must be ${NOTES_LIMIT} characters or fewer.` }
  const rosterIds = input.roster.map((row) => row.rockPersonId)
  let mutationStarted = false
  let mutationCompleted = false
  try {
    const current = await loadMeeting(input.groupId, input.meeting, rosterIds)
    let occurrenceId = current.identity.occurrenceId
    if (!occurrenceId) {
      mutationStarted = true
      occurrenceId = await mutate<number>('AttendanceOccurrences', 'POST', {
        GroupId: input.groupId, LocationId: input.meeting.locationId, ScheduleId: input.meeting.scheduleId,
        OccurrenceDate: input.meeting.date, Notes: notes, DidNotOccur: input.didNotMeet,
      })
      mutationCompleted = true
      if (!positive(occurrenceId)) throw new Error('Rock did not return the created occurrence Id')
    } else {
      const existing = await rockFetch<RockOccurrence>({ endpoint: `AttendanceOccurrences/${occurrenceId}`, ...REQUEST })
      mutationStarted = true
      await mutate<void>(`AttendanceOccurrences/${occurrenceId}`, 'PUT', { ...existing, Notes: notes, DidNotOccur: input.didNotMeet })
      mutationCompleted = true
    }
    const allAttendances = await rockFetchAll<RockAttendance>({
      endpoint: 'Attendances', getKey: (item) => item.Id,
      params: { $filter: `OccurrenceId eq ${occurrenceId}`, $orderby: 'Id' }, ...REQUEST,
    })
    if (input.didNotMeet) {
      for (const attendance of allAttendances) {
        mutationStarted = true
        await mutate<void>(`Attendances/${attendance.Id}`, 'PUT', { ...attendance, DidAttend: null })
        mutationCompleted = true
      }
    } else {
      const aliases = await aliasesByPerson(rosterIds)
      const primaryAliasToPerson = new Map([...aliases].map(([personId, aliasId]) => [aliasId, personId]))
      const existingByAlias = new Map(allAttendances.map((attendance) => [attendance.PersonAliasId, attendance]))
      const existingByPerson = new Map<number, RockAttendance>()
      const primaryAliasIds = new Set(aliases.values())
      const attendancePeople = await peopleByAlias([...new Set(allAttendances.flatMap((attendance) =>
        positive(attendance.PersonAliasId) && !primaryAliasIds.has(attendance.PersonAliasId)
          ? [attendance.PersonAliasId]
          : [],
      ))])
      for (const attendance of allAttendances) {
        const personId = positive(attendance.PersonAliasId)
          ? primaryAliasToPerson.get(attendance.PersonAliasId) ?? attendancePeople.get(attendance.PersonAliasId)
          : null
        if (!personId || !rosterIds.includes(personId)) continue
        if (existingByPerson.has(personId)) throw new Error('Rock returned duplicate attendance rows for one person')
        existingByPerson.set(personId, attendance)
      }
      for (const row of input.roster) {
        const aliasId = aliases.get(row.rockPersonId)
        if (!aliasId) throw new Error('Rock primary alias missing during save')
        const existing = existingByPerson.get(row.rockPersonId) ?? existingByAlias.get(aliasId)
        const didAttend = row.state === 'present'
        mutationStarted = true
        if (existing) {
          await mutate<void>(`Attendances/${existing.Id}`, 'PUT', { ...existing, DidAttend: didAttend })
        } else {
          await mutate<number>('Attendances', 'POST', {
            OccurrenceId: occurrenceId, PersonAliasId: aliasId, DidAttend: didAttend,
            StartDateTime: input.meeting.startDateTime,
          })
        }
        mutationCompleted = true
      }
    }
    try {
      const state = await loadMeeting(input.groupId, { ...input.meeting, occurrenceId }, rosterIds)
      return { status: 'saved', state }
    } catch {
      return { status: 'read-back-failed', message: 'Rock saved the attendance, but the canonical result could not be reloaded.' }
    }
  } catch (error) {
    return mutationCompleted || (mutationStarted && mutationOutcomeUnknown(error))
      ? { status: 'outcome-unknown', message: 'Rock may have received part of this save. Reload before trying again.' }
      : { status: 'rejected', message: 'Rock rejected the attendance save.' }
  }
}
