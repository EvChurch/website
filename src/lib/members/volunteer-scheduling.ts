const PAGE_SIZE = 100
const MAX_PAGES = 10
// Rock v19.2 enforces a low OData node-count limit. Keep OR filters small
// enough to leave room for the surrounding status/date predicates.
const FILTER_ID_CHUNK_SIZE = 8
const REQUEST_TIMEOUT_MS = 4_000
const OPERATION_TIMEOUT_MS = 6_000
const MAX_CONCURRENT_SCHEDULE_READS = 2
const MAX_CONCURRENT_BACKGROUND_READS = 1
const PERSON_REQUEST_LIMIT = 5
const PERSON_BACKGROUND_REQUEST_LIMIT = 4
const PERSON_THROTTLE_WINDOW_MS = 10_000
const THROTTLE_RETENTION_MS = 60_000
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const PLACEHOLDER_PATTERN = /change-me|replace-me|generate-with/i

interface SchedulingConfig {
  apiUrl: string
  apiKey: string
}

interface RockPersonAlias {
  Id: number
  PersonId: number
}

interface RockAttendance {
  id: number
  guid: string
  personAliasId: number
  requestedToAttend: boolean | null
  scheduledToAttend: boolean | null
  didAttend: boolean | null
  rsvp: 'unknown' | 'yes' | 'no' | 'maybe'
  declined: boolean
  occurrenceStart: string
  occurrenceId: number
}

interface RockOccurrence {
  id: number
  occurrenceDate: string
  didNotOccur: boolean
  groupId: number
  scheduleId: number | null
  locationId: number | null
}

interface RockRelatedEntity {
  id: number
  name: string | null
  isActive: boolean
}

type SchedulingEndpoint =
  | 'PersonAlias'
  | 'Attendances'
  | 'AttendanceOccurrences'
  | 'Groups'
  | 'Schedules'
  | 'Locations'

export interface VolunteerScheduleAssignment {
  id: string
  title: string
  occurrenceStart: string
  scheduleName: string | null
  locationName: string | null
}

export type VolunteerScheduleResult =
  | {
      status: 'available'
      requests: VolunteerScheduleAssignment[]
      upcoming: VolunteerScheduleAssignment[]
      declined: VolunteerScheduleAssignment[]
    }
  | {
      status: 'unavailable'
      reason: 'invalid-configuration' | 'invalid-person' | 'rock-unavailable' | 'malformed-response' | 'rate-limited'
      requests: []
      upcoming: []
      declined: []
      retryAfterSeconds?: number
    }

export type VolunteerScheduleResponse = 'accept' | 'decline'

export type VolunteerScheduleResponseResult =
  | { status: 'accepted' | 'declined' }
  | { status: 'invalid-request' | 'stale' | 'busy' | 'rock-unavailable' | 'outcome-unknown' }

class MalformedRockResponseError extends Error {}

class RockSchedulingWriteError extends Error {
  constructor(readonly status: number) {
    super(`Scheduling write rejected with status ${status}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function requiredSetting(name: string) {
  const value = process.env[name]?.trim()
  if (!value || PLACEHOLDER_PATTERN.test(value)) throw new Error(`Invalid ${name}`)
  return value
}

function readSchedulingConfig(): SchedulingConfig {
  const apiUrl = new URL(requiredSetting('ROCK_API_URL'))
  if (
    apiUrl.protocol !== 'https:' ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    apiUrl.pathname.replace(/\/+$/u, '') !== '/api'
  ) {
    throw new Error('Invalid ROCK_API_URL')
  }

  const apiKey = requiredSetting('ROCK_API_KEY')

  return {
    apiUrl: apiUrl.toString().replace(/\/+$/u, ''),
    apiKey,
  }
}

async function schedulingRead(
  config: SchedulingConfig,
  endpoint: SchedulingEndpoint,
  params: Record<string, string>,
  operationSignal: AbortSignal,
): Promise<unknown> {
  const url = new URL(`${config.apiUrl}/${endpoint}`)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)

  const requestSignal = AbortSignal.any([
    operationSignal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ])
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Authorization-Token': config.apiKey,
    },
    signal: requestSignal,
    next: { revalidate: 0 },
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`Scheduling read rejected with status ${response.status}`)
  }

  try {
    return await response.json()
  } catch (error) {
    if (requestSignal.aborted) throw requestSignal.reason
    throw new MalformedRockResponseError('Scheduling read returned invalid JSON', { cause: error })
  }
}

async function schedulingWrite(
  config: SchedulingConfig,
  action: 'ScheduledPersonConfirm' | 'ScheduledPersonDecline',
  attendanceId: number,
  operationSignal: AbortSignal,
) {
  const url = new URL(`${config.apiUrl}/Attendances/${action}`)
  url.searchParams.set('attendanceId', String(attendanceId))
  const response = await fetch(url, {
    method: 'PUT',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Authorization-Token': config.apiKey,
    },
    signal: AbortSignal.any([
      operationSignal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]),
    next: { revalidate: 0 },
  })
  await response.body?.cancel()
  if (!response.ok) throw new RockSchedulingWriteError(response.status)
}

async function readPages(
  config: SchedulingConfig,
  endpoint: SchedulingEndpoint,
  params: Record<string, string>,
  operationSignal: AbortSignal,
) {
  const values: unknown[] = []
  let previousFullPage: string | null = null
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const skip = pageIndex * PAGE_SIZE
    const page = await schedulingRead(config, endpoint, {
      ...params,
      $top: String(PAGE_SIZE),
      $skip: String(skip),
    }, operationSignal)
    if (!Array.isArray(page)) throw new MalformedRockResponseError(`${endpoint} did not return an array`)
    if (page.length > PAGE_SIZE) {
      throw new MalformedRockResponseError(`${endpoint} exceeded the requested page size`)
    }
    if (page.length === PAGE_SIZE) {
      const fingerprint = JSON.stringify(page)
      if (fingerprint === previousFullPage) {
        throw new MalformedRockResponseError(`${endpoint} pagination did not advance`)
      }
      previousFullPage = fingerprint
    }
    values.push(...page)
    if (page.length < PAGE_SIZE) return values
  }
  throw new MalformedRockResponseError(`${endpoint} exceeded the pagination limit`)
}

function parseAliases(value: unknown[], personId: number): RockPersonAlias[] {
  return value.map((item) => {
    if (!isRecord(item) || !isPositiveInteger(item.Id) || item.PersonId !== personId) {
      throw new MalformedRockResponseError('Rock returned an invalid PersonAlias row')
    }
    return { Id: item.Id, PersonId: personId }
  })
}

function optionalBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean'
}

function optionalName(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined
  return normalized
}

function parseRsvp(value: unknown): RockAttendance['rsvp'] | null {
  if (value === 3 || value === 'Unknown' || value === 'None') return 'unknown'
  if (value === 1 || value === 'Yes') return 'yes'
  if (value === 0 || value === 'No') return 'no'
  if (value === 2 || value === 'Maybe') return 'maybe'
  return null
}

function parseRelatedEntity(
  value: unknown,
  options: { nameRequired: boolean },
): RockRelatedEntity | null {
  if (!isRecord(value) || !isPositiveInteger(value.Id)) return null
  const name = optionalName(value.Name)
  if (name === undefined || (options.nameRequired && name === null)) return null
  if (value.IsActive !== undefined && typeof value.IsActive !== 'boolean') return null
  return { id: value.Id, name, isActive: value.IsActive !== false }
}

function parseAttendance(value: unknown): RockAttendance | null {
  if (!isRecord(value)) return null
  const rsvp = parseRsvp(value.RSVP)
  const occurrenceStart = parseRockDateTime(value.StartDateTime)
  if (
    !isPositiveInteger(value.Id) ||
    typeof value.Guid !== 'string' ||
    !GUID_PATTERN.test(value.Guid) ||
    !isPositiveInteger(value.PersonAliasId) ||
    !optionalBoolean(value.RequestedToAttend) ||
    !optionalBoolean(value.ScheduledToAttend) ||
    !optionalBoolean(value.DidAttend) ||
    rsvp === null ||
    !isPositiveInteger(value.OccurrenceId) ||
    !occurrenceStart ||
    !(
      value.DeclineReasonValueId === null ||
      value.DeclineReasonValueId === undefined ||
      isPositiveInteger(value.DeclineReasonValueId)
    )
  ) return null

  return {
    id: value.Id,
    guid: value.Guid.toLowerCase(),
    personAliasId: value.PersonAliasId,
    requestedToAttend: value.RequestedToAttend,
    scheduledToAttend: value.ScheduledToAttend,
    didAttend: value.DidAttend,
    rsvp,
    declined: isPositiveInteger(value.DeclineReasonValueId),
    occurrenceStart,
    occurrenceId: value.OccurrenceId,
  }
}

function optionalPositiveInteger(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null
  return isPositiveInteger(value) ? value : undefined
}

function parseOccurrence(value: unknown): RockOccurrence | null {
  if (!isRecord(value)) return null
  const scheduleId = optionalPositiveInteger(value.ScheduleId)
  const locationId = optionalPositiveInteger(value.LocationId)
  if (
    !isPositiveInteger(value.Id) ||
    !isPositiveInteger(value.GroupId) ||
    scheduleId === undefined ||
    locationId === undefined ||
    typeof value.OccurrenceDate !== 'string' ||
    !calendarDate(value.OccurrenceDate) ||
    !optionalBoolean(value.DidNotOccur)
  ) return null
  return {
    id: value.Id,
    occurrenceDate: value.OccurrenceDate,
    didNotOccur: value.DidNotOccur === true,
    groupId: value.GroupId,
    scheduleId,
    locationId,
  }
}

function parsedMap<T extends { id: number }>(
  values: unknown[],
  parse: (value: unknown) => T | null,
  label: string,
) {
  const result = new Map<number, T>()
  for (const value of values) {
    const parsed = parse(value)
    if (!parsed) throw new MalformedRockResponseError(`Rock returned an invalid ${label} row`)
    const existing = result.get(parsed.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(parsed)) {
      throw new MalformedRockResponseError(`Rock returned conflicting ${label} rows`)
    }
    result.set(parsed.id, parsed)
  }
  return result
}

function aucklandDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function calendarDate(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T|$)/u.exec(value)
  return match?.[1] ?? null
}

const aucklandDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function aucklandParts(date: Date) {
  return Object.fromEntries(
    aucklandDateTimeFormatter.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>
}

function parseRockDateTime(value: unknown) {
  if (typeof value !== 'string') return null
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  if (zoned) {
    const instant = new Date(value)
    return Number.isFinite(instant.getTime()) ? instant.toISOString() : null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,7})?)?$/u.exec(value)
  if (!match) return null
  const desired = match.slice(1).map(Number)
  const [year, month, day, hour, minute, second = 0] = desired
  const wallTime = Date.UTC(year, month - 1, day, hour, minute, second)
  const firstGuess = new Date(wallTime)
  const displayed = aucklandParts(firstGuess)
  const displayedWallTime = Date.UTC(
    displayed.year, displayed.month - 1, displayed.day,
    displayed.hour, displayed.minute, displayed.second,
  )
  const instant = new Date(wallTime - (displayedWallTime - wallTime))
  const verified = aucklandParts(instant)
  if (
    verified.year !== year || verified.month !== month || verified.day !== day ||
    verified.hour !== hour || verified.minute !== minute || verified.second !== second
  ) return null
  return instant.toISOString()
}

function chunks<T>(values: T[], size: number) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  )
}

async function readByIds(
  config: SchedulingConfig,
  endpoint: Exclude<SchedulingEndpoint, 'PersonAlias' | 'Attendances'>,
  ids: number[],
  select: string,
  operationSignal: AbortSignal,
) {
  const values: unknown[] = []
  for (const idChunk of chunks([...new Set(ids)], FILTER_ID_CHUNK_SIZE)) {
    values.push(...await readPages(config, endpoint, {
      $filter: idChunk.map((id) => `Id eq ${id}`).join(' or '),
      $orderby: 'Id',
      $select: select,
    }, operationSignal))
  }
  return values
}

async function readAttendances(
  config: SchedulingConfig,
  aliasIds: number[],
  today: string,
  operationSignal: AbortSignal,
) {
  const values: unknown[] = []
  for (const aliasChunk of chunks(aliasIds, FILTER_ID_CHUNK_SIZE)) {
    const aliasFilter = aliasChunk.map((id) => `PersonAliasId eq ${id}`).join(' or ')
    values.push(...await readPages(config, 'Attendances', {
      $filter: `(${aliasFilter}) and DidAttend ne true and StartDateTime ge datetime'${today}T00:00:00' and (RequestedToAttend eq true or ScheduledToAttend eq true)`,
      $orderby: 'StartDateTime,Guid',
      $select: 'Id,Guid,PersonAliasId,RequestedToAttend,ScheduledToAttend,DidAttend,RSVP,DeclineReasonValueId,OccurrenceId,StartDateTime',
    }, operationSignal))
  }
  return values
}

function project(
  attendance: RockAttendance,
  group: RockRelatedEntity,
  schedule: RockRelatedEntity | null,
  location: RockRelatedEntity | null,
): VolunteerScheduleAssignment {
  return {
    id: `rock-schedule:${attendance.guid}`,
    title: group.name as string,
    occurrenceStart: attendance.occurrenceStart,
    scheduleName: schedule?.name ?? null,
    locationName: location?.name ?? null,
  }
}

function sortAssignments(left: VolunteerScheduleAssignment, right: VolunteerScheduleAssignment) {
  return Date.parse(left.occurrenceStart) - Date.parse(right.occurrenceStart) || left.id.localeCompare(right.id)
}

function unavailable(
  reason: Extract<VolunteerScheduleResult, { status: 'unavailable' }>['reason'],
  retryAfterSeconds?: number,
): VolunteerScheduleResult {
  return {
    status: 'unavailable',
    reason,
    requests: [],
    upcoming: [],
    declined: [],
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  }
}

async function loadVolunteerSchedule(
  personId: number,
  now = new Date(),
): Promise<VolunteerScheduleResult> {
  if (!isPositiveInteger(personId) || !Number.isFinite(now.getTime())) return unavailable('invalid-person')

  let config: SchedulingConfig
  try {
    config = readSchedulingConfig()
  } catch {
    return unavailable('invalid-configuration')
  }

  try {
    const operationSignal = AbortSignal.timeout(OPERATION_TIMEOUT_MS)
    const aliases = parseAliases(await readPages(config, 'PersonAlias', {
      $filter: `PersonId eq ${personId}`,
      $orderby: 'Id',
      $select: 'Id,PersonId',
    }, operationSignal), personId)
    if (aliases.length === 0) return unavailable('invalid-person')

    const aliasIds = new Set(aliases.map((alias) => alias.Id))
    const today = aucklandDate(now)
    const rawAttendances = await readAttendances(config, [...aliasIds], today, operationSignal)

    const byGuid = new Map<string, RockAttendance>()
    for (const raw of rawAttendances) {
      if (!isRecord(raw) || !isPositiveInteger(raw.PersonAliasId)) {
        throw new MalformedRockResponseError('Rock returned an Attendance row without valid ownership')
      }
      if (!aliasIds.has(raw.PersonAliasId)) continue
      const attendance = parseAttendance(raw)
      if (!attendance) throw new MalformedRockResponseError('Rock returned an invalid owned Attendance row')
      const existing = byGuid.get(attendance.guid)
      if (existing && JSON.stringify(existing) !== JSON.stringify(attendance)) {
        throw new MalformedRockResponseError('Rock returned conflicting Attendance rows')
      }
      byGuid.set(attendance.guid, attendance)
    }

    const occurrencesById = parsedMap(
      await readByIds(
        config,
        'AttendanceOccurrences',
        [...byGuid.values()].map(({ occurrenceId }) => occurrenceId),
        'Id,GroupId,LocationId,ScheduleId,OccurrenceDate,DidNotOccur',
        operationSignal,
      ),
      parseOccurrence,
      'AttendanceOccurrence',
    )
    const occurrences = [...occurrencesById.values()]
    const metadataResults = await Promise.allSettled([
      readByIds(config, 'Groups', occurrences.map(({ groupId }) => groupId), 'Id,Name,IsActive', operationSignal)
        .then((values) => parsedMap(values, (value) => parseRelatedEntity(value, { nameRequired: true }), 'Group')),
      readByIds(
        config,
        'Schedules',
        occurrences.flatMap(({ scheduleId }) => scheduleId ? [scheduleId] : []),
        'Id,Name,IsActive',
        operationSignal,
      ).then((values) => parsedMap(values, (value) => parseRelatedEntity(value, { nameRequired: false }), 'Schedule')),
      readByIds(
        config,
        'Locations',
        occurrences.flatMap(({ locationId }) => locationId ? [locationId] : []),
        'Id,Name,IsActive',
        operationSignal,
      ).then((values) => parsedMap(values, (value) => parseRelatedEntity(value, { nameRequired: false }), 'Location')),
    ])
    const rejectedMetadata = metadataResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    if (rejectedMetadata) throw rejectedMetadata.reason
    const [groupsById, schedulesById, locationsById] = metadataResults.map(
      (result) => (result as PromiseFulfilledResult<Map<number, RockRelatedEntity>>).value,
    )

    const requests: VolunteerScheduleAssignment[] = []
    const upcoming: VolunteerScheduleAssignment[] = []
    const declined: VolunteerScheduleAssignment[] = []
    for (const attendance of byGuid.values()) {
      const occurrence = occurrencesById.get(attendance.occurrenceId)
      if (!occurrence) throw new MalformedRockResponseError('Rock omitted a referenced AttendanceOccurrence')
      const group = groupsById.get(occurrence.groupId)
      const schedule = occurrence.scheduleId ? schedulesById.get(occurrence.scheduleId) : null
      const location = occurrence.locationId ? locationsById.get(occurrence.locationId) : null
      if (
        !group ||
        (occurrence.scheduleId !== null && !schedule) ||
        (occurrence.locationId !== null && !location)
      ) throw new MalformedRockResponseError('Rock omitted referenced scheduling metadata')
      const projectedSchedule = schedule ?? null
      const projectedLocation = location ?? null

      const occurrenceDate = calendarDate(occurrence.occurrenceDate)
      if (
        !occurrenceDate || occurrenceDate < today ||
        Date.parse(attendance.occurrenceStart) < now.getTime() || attendance.didAttend === true ||
        occurrence.didNotOccur ||
        !group.isActive || schedule?.isActive === false || location?.isActive === false
      ) continue

      if (isDeclinedAttendance(attendance)) {
        declined.push(project(attendance, group, projectedSchedule, projectedLocation))
      } else if (
        attendance.requestedToAttend === true &&
        attendance.scheduledToAttend !== true &&
        (attendance.rsvp === 'unknown' || attendance.rsvp === 'maybe')
      ) requests.push(project(attendance, group, projectedSchedule, projectedLocation))
      else if (attendance.scheduledToAttend === true) {
        upcoming.push(project(attendance, group, projectedSchedule, projectedLocation))
      }
    }

    requests.sort(sortAssignments)
    upcoming.sort(sortAssignments)
    declined.sort(sortAssignments)
    return { status: 'available', requests, upcoming, declined }
  } catch (error) {
    return unavailable(error instanceof MalformedRockResponseError ? 'malformed-response' : 'rock-unavailable')
  }
}

const responseWrites = new Set<string>()
const responseWritePersons = new Set<number>()
let activeResponseWrites = 0
const MAX_CONCURRENT_RESPONSE_WRITES = 2

function assignmentGuid(assignmentId: string) {
  const prefix = 'rock-schedule:'
  if (!assignmentId.startsWith(prefix)) return null
  const guid = assignmentId.slice(prefix.length)
  return GUID_PATTERN.test(guid) ? guid.toLowerCase() : null
}

async function readOwnedAttendance(
  config: SchedulingConfig,
  personId: number,
  guid: string,
  operationSignal: AbortSignal,
) {
  const aliases = parseAliases(await readPages(config, 'PersonAlias', {
    $filter: `PersonId eq ${personId}`,
    $orderby: 'Id',
    $select: 'Id,PersonId',
  }, operationSignal), personId)
  const aliasIds = new Set(aliases.map(({ Id }) => Id))
  if (aliasIds.size === 0) return null

  const rows = await readPages(config, 'Attendances', {
    $filter: `Guid eq guid'${guid}'`,
    $orderby: 'Id',
    $select: 'Id,Guid,PersonAliasId,RequestedToAttend,ScheduledToAttend,DidAttend,RSVP,DeclineReasonValueId,OccurrenceId,StartDateTime',
  }, operationSignal)
  if (rows.length !== 1) return null
  const attendance = parseAttendance(rows[0])
  if (!attendance || !aliasIds.has(attendance.personAliasId) || attendance.guid !== guid) return null
  return attendance
}

function isPendingAttendance(attendance: RockAttendance) {
  return (
    attendance.requestedToAttend === true &&
    attendance.scheduledToAttend !== true &&
    attendance.didAttend !== true &&
    !attendance.declined &&
    (attendance.rsvp === 'unknown' || attendance.rsvp === 'maybe')
  )
}

function isConfirmedAttendance(attendance: RockAttendance) {
  return (
    attendance.scheduledToAttend === true &&
    attendance.didAttend !== true &&
    !attendance.declined &&
    attendance.rsvp !== 'no'
  )
}

function isDeclinedAttendance(attendance: RockAttendance) {
  return (
    attendance.didAttend !== true &&
    (attendance.rsvp === 'no' || attendance.declined)
  )
}

function hasExpectedResponse(
  attendance: RockAttendance | null,
  response: VolunteerScheduleResponse,
) {
  if (!attendance) return false
  return response === 'accept'
    ? attendance.scheduledToAttend === true && attendance.rsvp === 'yes' && !attendance.declined
    : attendance.scheduledToAttend === false && attendance.rsvp === 'no'
}

export async function respondToVolunteerSchedule(
  personId: number,
  assignmentId: string,
  response: VolunteerScheduleResponse,
  now = new Date(),
): Promise<VolunteerScheduleResponseResult> {
  if (
    !isPositiveInteger(personId) ||
    typeof assignmentId !== 'string' ||
    (response !== 'accept' && response !== 'decline') ||
    !Number.isFinite(now.getTime())
  ) return { status: 'invalid-request' }

  const guid = assignmentGuid(assignmentId)
  if (!guid) return { status: 'invalid-request' }
  const lockKey = `${personId}:${guid}`
  if (
    responseWrites.has(lockKey) ||
    responseWritePersons.has(personId) ||
    activeResponseWrites >= MAX_CONCURRENT_RESPONSE_WRITES
  ) return { status: 'busy' }
  responseWrites.add(lockKey)
  responseWritePersons.add(personId)
  activeResponseWrites += 1

  try {
    const currentSchedule = await loadVolunteerSchedule(personId, now)
    const assignmentId = `rock-schedule:${guid}`
    const isPendingRequest = currentSchedule.status === 'available' &&
      currentSchedule.requests.some(({ id }) => id === assignmentId)
    const isConfirmedCommitment = currentSchedule.status === 'available' &&
      currentSchedule.upcoming.some(({ id }) => id === assignmentId)
    const isDeclinedAssignment = currentSchedule.status === 'available' &&
      currentSchedule.declined.some(({ id }) => id === assignmentId)
    if (
      currentSchedule.status !== 'available' ||
      (response === 'accept'
        ? !isPendingRequest && !isDeclinedAssignment
        : !isPendingRequest && !isConfirmedCommitment)
    ) return {
      status: currentSchedule.status === 'unavailable' ? 'rock-unavailable' : 'stale',
    }

    const config = readSchedulingConfig()
    const preflightSignal = AbortSignal.timeout(OPERATION_TIMEOUT_MS)
    const attendance = await readOwnedAttendance(config, personId, guid, preflightSignal)
    const canRespond = attendance && (
      isPendingAttendance(attendance) ||
      (response === 'accept' && isDeclinedAttendance(attendance)) ||
      (response === 'decline' && isConfirmedAttendance(attendance))
    )
    if (!canRespond) return { status: 'stale' }

    let writeError: unknown = null
    try {
      await schedulingWrite(
        config,
        response === 'accept' ? 'ScheduledPersonConfirm' : 'ScheduledPersonDecline',
        attendance.id,
        preflightSignal,
      )
    } catch (error) {
      writeError = error
    }

    let canonical: RockAttendance | null = null
    try {
      canonical = await readOwnedAttendance(
        config,
        personId,
        guid,
        AbortSignal.timeout(OPERATION_TIMEOUT_MS),
      )
    } catch {
      return { status: 'outcome-unknown' }
    }
    if (hasExpectedResponse(canonical, response)) {
      return { status: response === 'accept' ? 'accepted' : 'declined' }
    }
    if (writeError instanceof RockSchedulingWriteError && writeError.status < 500 && writeError.status !== 429) {
      return { status: 'stale' }
    }
    return { status: 'outcome-unknown' }
  } catch {
    return { status: 'rock-unavailable' }
  } finally {
    responseWrites.delete(lockKey)
    responseWritePersons.delete(personId)
    activeResponseWrites = Math.max(0, activeResponseWrites - 1)
  }
}

let activeScheduleReads = 0
let activeBackgroundReads = 0
const scheduleReadsByPerson = new Map<number, Promise<VolunteerScheduleResult>>()
const scheduleReadWindowsByPerson = new Map<number, {
  count: number
  backgroundCount: number
  windowStartedAt: number
}>()

function acquirePersonRead(personId: number, priority: 'foreground' | 'background'):
  | { status: 'acquired' }
  | { status: 'throttled'; retryAfterSeconds: number } {
  const now = Date.now()
  for (const [storedPersonId, window] of scheduleReadWindowsByPerson) {
    if (now - window.windowStartedAt >= THROTTLE_RETENTION_MS) {
      scheduleReadWindowsByPerson.delete(storedPersonId)
    }
  }

  const window = scheduleReadWindowsByPerson.get(personId)
  if (
    window &&
    now - window.windowStartedAt < PERSON_THROTTLE_WINDOW_MS &&
    (window.count >= PERSON_REQUEST_LIMIT || (
      priority === 'background' &&
      window.backgroundCount >= PERSON_BACKGROUND_REQUEST_LIMIT
    ))
  ) return {
    status: 'throttled',
    retryAfterSeconds: Math.max(1, Math.ceil(
      (PERSON_THROTTLE_WINDOW_MS - (now - window.windowStartedAt)) / 1000,
    )),
  }

  scheduleReadWindowsByPerson.set(personId, window && now - window.windowStartedAt < PERSON_THROTTLE_WINDOW_MS
    ? {
        ...window,
        count: window.count + 1,
        backgroundCount: window.backgroundCount + (priority === 'background' ? 1 : 0),
      }
    : {
        count: 1,
        backgroundCount: priority === 'background' ? 1 : 0,
        windowStartedAt: now,
      })
  return { status: 'acquired' }
}

export function __resetVolunteerScheduleLoadProtectionForTests() {
  if (process.env.NODE_ENV !== 'test') return
  activeScheduleReads = 0
  activeBackgroundReads = 0
  scheduleReadsByPerson.clear()
  scheduleReadWindowsByPerson.clear()
  responseWrites.clear()
  responseWritePersons.clear()
  activeResponseWrites = 0
}

export function getVolunteerSchedule(
  personId: number,
  now = new Date(),
  priority: 'foreground' | 'background' = 'foreground',
): Promise<VolunteerScheduleResult> {
  const existing = scheduleReadsByPerson.get(personId)
  if (existing) return existing
  if (activeScheduleReads >= MAX_CONCURRENT_SCHEDULE_READS) {
    return Promise.resolve(unavailable('rock-unavailable'))
  }
  if (priority === 'background' && activeBackgroundReads >= MAX_CONCURRENT_BACKGROUND_READS) {
    return Promise.resolve(unavailable('rock-unavailable'))
  }
  const admission = acquirePersonRead(personId, priority)
  if (admission.status === 'throttled') {
    return Promise.resolve(unavailable('rate-limited', admission.retryAfterSeconds))
  }

  activeScheduleReads += 1
  if (priority === 'background') activeBackgroundReads += 1
  const read = loadVolunteerSchedule(personId, now).finally(() => {
    if (scheduleReadsByPerson.get(personId) === read) scheduleReadsByPerson.delete(personId)
    activeScheduleReads = Math.max(0, activeScheduleReads - 1)
    if (priority === 'background') {
      activeBackgroundReads = Math.max(0, activeBackgroundReads - 1)
    }
  })
  scheduleReadsByPerson.set(personId, read)
  return read
}
