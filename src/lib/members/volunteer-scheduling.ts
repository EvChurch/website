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
const GROUP_SCHEDULE_DECLINE_REASON_GUID = '70c9f9c4-20cc-43dd-888d-9243853a0e52'

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
  declineReasonValueId: number | null
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
  | 'People'
  | 'PersonAlias'
  | 'Attendances'
  | 'AttendanceOccurrences'
  | 'GroupMembers'
  | 'Groups'
  | 'GroupTypes'
  | 'PersonScheduleExclusions'
  | 'Schedules'
  | 'Locations'
  | 'DefinedTypes'
  | 'DefinedValues'

export interface VolunteerScheduleDeclineReason {
  id: number
  label: string
}

export interface VolunteerScheduleGroup {
  id: number
  name: string
}

export type VolunteerScheduleGroupsResult =
  | { status: 'available'; groups: VolunteerScheduleGroup[] }
  | { status: 'unavailable'; groups: [] }

export type VolunteerScheduleUnavailabilityResult =
  | { status: 'saved' }
  | { status: 'invalid-request' | 'busy' | 'rock-unavailable' | 'outcome-unknown' }

export type VolunteerScheduleUnavailabilityDeleteResult =
  | { status: 'deleted' }
  | { status: 'invalid-request' | 'busy' | 'rock-unavailable' | 'outcome-unknown' }

export interface VolunteerScheduleUnavailability {
  id: string
  startDate: string
  endDate: string
  groupName: string
  notes: string | null
}

export type VolunteerScheduleUnavailabilityListResult =
  | { status: 'available'; exclusions: VolunteerScheduleUnavailability[] }
  | { status: 'unavailable'; exclusions: [] }

interface VolunteerScheduleAvailabilityContext {
  groups: VolunteerScheduleGroupsResult
  unavailability: VolunteerScheduleUnavailabilityListResult
}

export interface VolunteerServiceOverview extends VolunteerScheduleAvailabilityContext {
  schedule: VolunteerScheduleResult
}

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

async function schedulingPatchDecline(
  config: SchedulingConfig,
  attendanceId: number,
  declineReasonValueId: number,
  now: Date,
  operationSignal: AbortSignal,
) {
  const response = await fetch(`${config.apiUrl}/Attendances/${attendanceId}`, {
    method: 'PATCH',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Authorization-Token': config.apiKey,
    },
    body: JSON.stringify({
      ScheduledToAttend: false,
      RSVPDateTime: now.toISOString(),
      RSVP: 0,
      DeclineReasonValueId: declineReasonValueId,
    }),
    signal: AbortSignal.any([
      operationSignal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]),
    next: { revalidate: 0 },
  })
  await response.body?.cancel()
  if (!response.ok) throw new RockSchedulingWriteError(response.status)
}

async function schedulingCreateExclusion(
  config: SchedulingConfig,
  input: {
    personAliasId: number
    startDate: string
    endDate: string
    groupId: number
    notes: string
  },
  operationSignal: AbortSignal,
) {
  const response = await fetch(`${config.apiUrl}/PersonScheduleExclusions`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Authorization-Token': config.apiKey,
    },
    body: JSON.stringify({
      PersonAliasId: input.personAliasId,
      StartDate: input.startDate,
      EndDate: input.endDate,
      GroupId: input.groupId,
      Title: input.notes || null,
      ParentPersonScheduleExclusionId: null,
    }),
    signal: AbortSignal.any([
      operationSignal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]),
    next: { revalidate: 0 },
  })
  await response.body?.cancel()
  if (!response.ok) throw new RockSchedulingWriteError(response.status)
}

async function schedulingDeleteExclusion(
  config: SchedulingConfig,
  exclusionId: number,
  operationSignal: AbortSignal,
) {
  const response = await fetch(`${config.apiUrl}/PersonScheduleExclusions/${exclusionId}`, {
    method: 'DELETE',
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
    declineReasonValueId: isPositiveInteger(value.DeclineReasonValueId)
      ? value.DeclineReasonValueId
      : null,
    occurrenceStart,
    occurrenceId: value.OccurrenceId,
  }
}

async function loadDeclineReasons(
  config: SchedulingConfig,
  operationSignal: AbortSignal,
): Promise<VolunteerScheduleDeclineReason[]> {
  const definedTypes = await readPages(config, 'DefinedTypes', {
    $filter: `Guid eq guid'${GROUP_SCHEDULE_DECLINE_REASON_GUID}'`,
    $select: 'Id,Guid',
  }, operationSignal)
  if (
    definedTypes.length !== 1 ||
    !isRecord(definedTypes[0]) ||
    !isPositiveInteger(definedTypes[0].Id) ||
    String(definedTypes[0].Guid).toLowerCase() !== GROUP_SCHEDULE_DECLINE_REASON_GUID
  ) throw new MalformedRockResponseError('Rock omitted the schedule decline reason type')

  const values = await readPages(config, 'DefinedValues', {
    $filter: `DefinedTypeId eq ${definedTypes[0].Id} and IsActive eq true`,
    $orderby: 'Order,Id',
    $select: 'Id,Value,IsActive',
  }, operationSignal)
  return values.map((value) => {
    if (!isRecord(value) || !isPositiveInteger(value.Id) || value.IsActive !== true) {
      throw new MalformedRockResponseError('Rock returned an invalid decline reason')
    }
    const label = optionalName(value.Value)
    if (!label) throw new MalformedRockResponseError('Rock returned an unnamed decline reason')
    return { id: value.Id, label }
  })
}

export async function getVolunteerScheduleDeclineReasons(): Promise<VolunteerScheduleDeclineReason[]> {
  try {
    return await loadDeclineReasons(
      readSchedulingConfig(),
      AbortSignal.timeout(OPERATION_TIMEOUT_MS),
    )
  } catch {
    return []
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
  endpoint: Exclude<SchedulingEndpoint, 'PersonAlias' | 'Attendances' | 'PersonScheduleExclusions'>,
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

async function loadVolunteerScheduleGroups(
  config: SchedulingConfig,
  personId: number,
  operationSignal: AbortSignal,
): Promise<VolunteerScheduleGroup[]> {
  const memberships = await readPages(config, 'GroupMembers', {
    $filter: `PersonId eq ${personId} and GroupMemberStatus eq 'Active' and IsArchived eq false`,
    $orderby: 'GroupId,Id',
    $select: 'Id,PersonId,GroupId,GroupMemberStatus,IsArchived',
  }, operationSignal)
  const groupIds = memberships.map((membership) => {
    if (
      !isRecord(membership) ||
      !isPositiveInteger(membership.Id) ||
      membership.PersonId !== personId ||
      !isPositiveInteger(membership.GroupId) ||
      (membership.GroupMemberStatus !== 1 && membership.GroupMemberStatus !== 'Active') ||
      membership.IsArchived !== false
    ) throw new MalformedRockResponseError('Rock returned an invalid GroupMember row')
    return membership.GroupId
  })
  if (groupIds.length === 0) return []

  const groups = await readByIds(
    config,
    'Groups',
    groupIds,
    'Id,Name,GroupTypeId,IsActive,IsArchived,DisableScheduling,DisableScheduleToolboxAccess,Order',
    operationSignal,
  )
  const groupTypeIds = groups.map((group) => {
    if (!isRecord(group) || !isPositiveInteger(group.GroupTypeId)) {
      throw new MalformedRockResponseError('Rock returned an invalid schedulable Group row')
    }
    return group.GroupTypeId
  })
  const groupTypes = await readByIds(
    config,
    'GroupTypes',
    groupTypeIds,
    'Id,IsSchedulingEnabled',
    operationSignal,
  )
  const schedulingByType = new Map<number, boolean>()
  for (const groupType of groupTypes) {
    if (
      !isRecord(groupType) ||
      !isPositiveInteger(groupType.Id) ||
      typeof groupType.IsSchedulingEnabled !== 'boolean'
    ) throw new MalformedRockResponseError('Rock returned an invalid GroupType row')
    schedulingByType.set(groupType.Id, groupType.IsSchedulingEnabled)
  }

  const result = new Map<number, VolunteerScheduleGroup>()
  for (const group of groups) {
    if (!isRecord(group) || !isPositiveInteger(group.Id) || !isPositiveInteger(group.GroupTypeId)) {
      throw new MalformedRockResponseError('Rock returned an invalid schedulable Group row')
    }
    const name = optionalName(group.Name)
    if (
      !name ||
      typeof group.IsActive !== 'boolean' ||
      typeof group.IsArchived !== 'boolean' ||
      typeof group.DisableScheduling !== 'boolean' ||
      typeof group.DisableScheduleToolboxAccess !== 'boolean' ||
      !schedulingByType.has(group.GroupTypeId)
    ) throw new MalformedRockResponseError('Rock returned malformed schedulable Group metadata')
    if (
      group.IsActive &&
      !group.IsArchived &&
      !group.DisableScheduling &&
      !group.DisableScheduleToolboxAccess &&
      schedulingByType.get(group.GroupTypeId) === true
    ) result.set(group.Id, { id: group.Id, name })
  }
  return [...result.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export async function getVolunteerScheduleGroups(personId: number): Promise<VolunteerScheduleGroupsResult> {
  return (await getVolunteerScheduleAvailabilityContext(personId)).groups
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
  declineReasonValueId?: number,
) {
  if (!attendance) return false
  return response === 'accept'
    ? attendance.scheduledToAttend === true && attendance.rsvp === 'yes' && !attendance.declined
    : attendance.scheduledToAttend === false && attendance.rsvp === 'no' &&
      attendance.declineReasonValueId === declineReasonValueId
}

export async function respondToVolunteerSchedule(
  personId: number,
  assignmentId: string,
  response: VolunteerScheduleResponse,
  now = new Date(),
  declineReasonValueId?: number,
): Promise<VolunteerScheduleResponseResult> {
  if (
    !isPositiveInteger(personId) ||
    typeof assignmentId !== 'string' ||
    (response !== 'accept' && response !== 'decline') ||
    !Number.isFinite(now.getTime()) ||
    (response === 'decline' && !isPositiveInteger(declineReasonValueId)) ||
    (response === 'accept' && declineReasonValueId !== undefined)
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
    if (response === 'decline') {
      const declineReasons = await loadDeclineReasons(config, preflightSignal)
      if (!declineReasons.some(({ id }) => id === declineReasonValueId)) {
        return { status: 'invalid-request' }
      }
    }
    const attendance = await readOwnedAttendance(config, personId, guid, preflightSignal)
    const canRespond = attendance && (
      isPendingAttendance(attendance) ||
      (response === 'accept' && isDeclinedAttendance(attendance)) ||
      (response === 'decline' && isConfirmedAttendance(attendance))
    )
    if (!canRespond) return { status: 'stale' }

    let writeError: unknown = null
    try {
      if (response === 'accept') {
        await schedulingWrite(config, 'ScheduledPersonConfirm', attendance.id, preflightSignal)
      } else {
        await schedulingPatchDecline(
          config,
          attendance.id,
          declineReasonValueId as number,
          now,
          preflightSignal,
        )
      }
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
    if (hasExpectedResponse(canonical, response, declineReasonValueId)) {
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

const unavailabilityWrites = new Set<number>()
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
}

function normalizedUnavailabilityNotes(value: unknown) {
  if (typeof value !== 'string') return null
  const notes = value.trim()
  if (notes.length > 100 || /[\u0000-\u001f\u007f]/u.test(notes)) return null
  return notes
}

async function loadPrimaryAliasId(
  config: SchedulingConfig,
  personId: number,
  operationSignal: AbortSignal,
) {
  const people = await readPages(config, 'People', {
    $filter: `Id eq ${personId}`,
    $orderby: 'Id',
    $select: 'Id,PrimaryAliasId',
  }, operationSignal)
  if (
    people.length !== 1 ||
    !isRecord(people[0]) ||
    people[0].Id !== personId ||
    !isPositiveInteger(people[0].PrimaryAliasId)
  ) throw new MalformedRockResponseError('Rock omitted the current person primary alias')
  return people[0].PrimaryAliasId
}

function unavailabilityGuid(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('rock-unavailability:')) return null
  const guid = value.slice('rock-unavailability:'.length)
  return GUID_PATTERN.test(guid) ? guid.toLowerCase() : null
}

async function loadOwnedUnavailability(
  config: SchedulingConfig,
  personAliasId: number,
  guid: string,
  operationSignal: AbortSignal,
) {
  const rows = await readPages(config, 'PersonScheduleExclusions', {
    $filter: `PersonAliasId eq ${personAliasId} and Guid eq guid'${guid}'`,
    $orderby: 'Id',
    $select: 'Id,Guid,PersonAliasId,EndDate',
  }, operationSignal)
  if (rows.length === 0) return null
  if (
    rows.length !== 1 ||
    !isRecord(rows[0]) ||
    !isPositiveInteger(rows[0].Id) ||
    rows[0].PersonAliasId !== personAliasId ||
    typeof rows[0].Guid !== 'string' ||
    rows[0].Guid.toLowerCase() !== guid ||
    typeof rows[0].EndDate !== 'string'
  ) throw new MalformedRockResponseError('Rock returned invalid schedule exclusion ownership')
  const endDate = calendarDate(rows[0].EndDate)
  if (!endDate) throw new MalformedRockResponseError('Rock returned invalid schedule exclusion date')
  return { id: rows[0].Id, endDate }
}

async function loadVolunteerScheduleUnavailability(
  config: SchedulingConfig,
  personId: number,
  now: Date,
  operationSignal: AbortSignal,
): Promise<VolunteerScheduleUnavailability[]> {
    const personAliasId = await loadPrimaryAliasId(config, personId, operationSignal)
    const today = aucklandDate(now)
    const rows = await readPages(config, 'PersonScheduleExclusions', {
      $filter: `PersonAliasId eq ${personAliasId} and EndDate ge datetime'${today}T00:00:00'`,
      $orderby: 'StartDate,EndDate,Id',
      $select: 'Id,Guid,PersonAliasId,StartDate,EndDate,GroupId,Title',
    }, operationSignal)
    const groupIds = rows.flatMap((row) => {
      if (!isRecord(row) || (row.GroupId !== null && !isPositiveInteger(row.GroupId))) {
        throw new MalformedRockResponseError('Rock returned an invalid schedule exclusion row')
      }
      return row.GroupId === null ? [] : [row.GroupId]
    })
    const groups = parsedMap(
      await readByIds(config, 'Groups', groupIds, 'Id,Name,IsActive', operationSignal),
      (value) => parseRelatedEntity(value, { nameRequired: true }),
      'Group',
    )
    const exclusions = rows.map((row): VolunteerScheduleUnavailability => {
      if (
        !isRecord(row) ||
        !isPositiveInteger(row.Id) ||
        typeof row.Guid !== 'string' ||
        !GUID_PATTERN.test(row.Guid) ||
        row.PersonAliasId !== personAliasId ||
        typeof row.StartDate !== 'string' ||
        typeof row.EndDate !== 'string' ||
        (row.GroupId !== null && !isPositiveInteger(row.GroupId))
      ) throw new MalformedRockResponseError('Rock returned malformed schedule exclusion data')
      const startDate = calendarDate(row.StartDate)
      const endDate = calendarDate(row.EndDate)
      const groupName = row.GroupId === null ? 'All serving groups' : groups.get(row.GroupId)?.name
      const notes = row.Title === null || row.Title === undefined ? null : optionalName(row.Title)
      if (!startDate || !endDate || startDate > endDate || !groupName || notes === undefined) {
        throw new MalformedRockResponseError('Rock returned invalid schedule exclusion metadata')
      }
      return {
        id: `rock-unavailability:${row.Guid.toLowerCase()}`,
        startDate,
        endDate,
        groupName,
        notes,
      }
    })
    return exclusions
}

async function matchingUnavailabilityExists(
  config: SchedulingConfig,
  input: {
    personAliasId: number
    startDate: string
    endDate: string
    groupId: number
    notes: string
  },
  operationSignal: AbortSignal,
) {
  const rows = await readPages(config, 'PersonScheduleExclusions', {
    $filter: `PersonAliasId eq ${input.personAliasId} and StartDate eq datetime'${input.startDate}T00:00:00' and EndDate eq datetime'${input.endDate}T00:00:00'`,
    $orderby: 'Id',
    $select: 'Id,PersonAliasId,StartDate,EndDate,GroupId,Title,ParentPersonScheduleExclusionId',
  }, operationSignal)
  return rows.some((row) => {
    if (!isRecord(row) || !isPositiveInteger(row.Id)) {
      throw new MalformedRockResponseError('Rock returned an invalid schedule exclusion row')
    }
    const title = row.Title === null || row.Title === undefined ? '' : row.Title
    const groupId = row.GroupId
    return row.PersonAliasId === input.personAliasId &&
      typeof row.StartDate === 'string' && calendarDate(row.StartDate) === input.startDate &&
      typeof row.EndDate === 'string' && calendarDate(row.EndDate) === input.endDate &&
      groupId === input.groupId &&
      title === input.notes &&
      (row.ParentPersonScheduleExclusionId === null || row.ParentPersonScheduleExclusionId === undefined)
  })
}

export async function saveVolunteerScheduleUnavailability(
  personId: number,
  input: {
    startDate: unknown
    endDate: unknown
    groupId?: unknown
    notes?: unknown
  },
  now = new Date(),
): Promise<VolunteerScheduleUnavailabilityResult> {
  const notes = normalizedUnavailabilityNotes(input.notes ?? '')
  const groupId = input.groupId
  if (
    !isPositiveInteger(personId) ||
    !Number.isFinite(now.getTime()) ||
    !isCalendarDate(input.startDate) ||
    !isCalendarDate(input.endDate) ||
    input.startDate > input.endDate ||
    input.startDate < aucklandDate(now) ||
    !isPositiveInteger(groupId) ||
    notes === null
  ) return { status: 'invalid-request' }
  if (unavailabilityWrites.has(personId)) return { status: 'busy' }
  unavailabilityWrites.add(personId)

  try {
    const config = readSchedulingConfig()
    const operationSignal = AbortSignal.timeout(OPERATION_TIMEOUT_MS)
    const personAliasId = await loadPrimaryAliasId(config, personId, operationSignal)

    const groups = await loadVolunteerScheduleGroups(config, personId, operationSignal)
    if (!groups.some(({ id }) => id === groupId)) return { status: 'invalid-request' }
    const exclusion = {
      personAliasId,
      startDate: input.startDate,
      endDate: input.endDate,
      groupId,
      notes,
    }
    if (await matchingUnavailabilityExists(config, exclusion, operationSignal)) {
      return { status: 'saved' }
    }

    try {
      await schedulingCreateExclusion(config, exclusion, operationSignal)
    } catch {
      // A timed-out write can still have reached Rock. Verify before reporting failure.
    }
    try {
      return await matchingUnavailabilityExists(
        config,
        exclusion,
        AbortSignal.timeout(OPERATION_TIMEOUT_MS),
      ) ? { status: 'saved' } : { status: 'outcome-unknown' }
    } catch {
      return { status: 'outcome-unknown' }
    }
  } catch {
    return { status: 'rock-unavailable' }
  } finally {
    unavailabilityWrites.delete(personId)
  }
}

export async function deleteVolunteerScheduleUnavailability(
  personId: number,
  exclusionId: unknown,
  now = new Date(),
): Promise<VolunteerScheduleUnavailabilityDeleteResult> {
  const guid = unavailabilityGuid(exclusionId)
  if (!isPositiveInteger(personId) || !guid || !Number.isFinite(now.getTime())) {
    return { status: 'invalid-request' }
  }
  if (unavailabilityWrites.has(personId)) return { status: 'busy' }
  unavailabilityWrites.add(personId)

  try {
    const config = readSchedulingConfig()
    const operationSignal = AbortSignal.timeout(OPERATION_TIMEOUT_MS)
    const personAliasId = await loadPrimaryAliasId(config, personId, operationSignal)
    const exclusion = await loadOwnedUnavailability(config, personAliasId, guid, operationSignal)
    if (exclusion === null) return { status: 'deleted' }
    if (exclusion.endDate < aucklandDate(now)) return { status: 'invalid-request' }

    try {
      await schedulingDeleteExclusion(config, exclusion.id, operationSignal)
    } catch {
      // A timed-out delete can still have reached Rock. Verify before reporting failure.
    }
    try {
      return await loadOwnedUnavailability(
        config,
        personAliasId,
        guid,
        AbortSignal.timeout(OPERATION_TIMEOUT_MS),
      ) === null ? { status: 'deleted' } : { status: 'outcome-unknown' }
    } catch {
      return { status: 'outcome-unknown' }
    }
  } catch {
    return { status: 'rock-unavailable' }
  } finally {
    unavailabilityWrites.delete(personId)
  }
}

let activeScheduleReads = 0
let activeBackgroundReads = 0
const scheduleReadsByPerson = new Map<number, Promise<VolunteerScheduleResult>>()
const scheduleAvailabilityReadsByPerson = new Map<number, Promise<VolunteerScheduleAvailabilityContext>>()
const serviceOverviewReadsByPerson = new Map<number, Promise<VolunteerServiceOverview>>()
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
  scheduleAvailabilityReadsByPerson.clear()
  serviceOverviewReadsByPerson.clear()
  scheduleReadWindowsByPerson.clear()
  responseWrites.clear()
  responseWritePersons.clear()
  activeResponseWrites = 0
  unavailabilityWrites.clear()
}

function unavailableScheduleAvailabilityContext(): VolunteerScheduleAvailabilityContext {
  return {
    groups: { status: 'unavailable', groups: [] },
    unavailability: { status: 'unavailable', exclusions: [] },
  }
}

async function loadVolunteerScheduleAvailabilityContext(
  personId: number,
  now: Date,
): Promise<VolunteerScheduleAvailabilityContext> {
  try {
    const config = readSchedulingConfig()
    const operationSignal = AbortSignal.timeout(OPERATION_TIMEOUT_MS)
    const [groups, unavailability] = await Promise.all([
      loadVolunteerScheduleGroups(config, personId, operationSignal)
        .then((loadedGroups): VolunteerScheduleGroupsResult => ({
          status: 'available',
          groups: loadedGroups,
        }))
        .catch((): VolunteerScheduleGroupsResult => ({ status: 'unavailable', groups: [] })),
      loadVolunteerScheduleUnavailability(config, personId, now, operationSignal)
        .then((exclusions): VolunteerScheduleUnavailabilityListResult => ({
          status: 'available',
          exclusions,
        }))
        .catch((): VolunteerScheduleUnavailabilityListResult => ({
          status: 'unavailable',
          exclusions: [],
        })),
    ])
    return { groups, unavailability }
  } catch {
    return unavailableScheduleAvailabilityContext()
  }
}

function getVolunteerScheduleAvailabilityContext(
  personId: number,
  now = new Date(),
): Promise<VolunteerScheduleAvailabilityContext> {
  if (!isPositiveInteger(personId) || !Number.isFinite(now.getTime())) {
    return Promise.resolve(unavailableScheduleAvailabilityContext())
  }
  const existing = scheduleAvailabilityReadsByPerson.get(personId)
  if (existing) return existing
  if (activeScheduleReads >= MAX_CONCURRENT_SCHEDULE_READS) {
    return Promise.resolve(unavailableScheduleAvailabilityContext())
  }
  const admission = acquirePersonRead(personId, 'foreground')
  if (admission.status === 'throttled') {
    return Promise.resolve(unavailableScheduleAvailabilityContext())
  }

  activeScheduleReads += 1
  const read = loadVolunteerScheduleAvailabilityContext(personId, now).finally(() => {
    if (scheduleAvailabilityReadsByPerson.get(personId) === read) {
      scheduleAvailabilityReadsByPerson.delete(personId)
    }
    activeScheduleReads = Math.max(0, activeScheduleReads - 1)
  })
  scheduleAvailabilityReadsByPerson.set(personId, read)
  return read
}

export function getVolunteerServiceOverview(
  personId: number,
  now = new Date(),
): Promise<VolunteerServiceOverview> {
  if (!isPositiveInteger(personId) || !Number.isFinite(now.getTime())) {
    return Promise.resolve({
      schedule: unavailable('invalid-person'),
      ...unavailableScheduleAvailabilityContext(),
    })
  }
  const existing = serviceOverviewReadsByPerson.get(personId)
  if (existing) return existing
  if (activeScheduleReads >= MAX_CONCURRENT_SCHEDULE_READS) {
    return Promise.resolve({
      schedule: unavailable('rock-unavailable'),
      ...unavailableScheduleAvailabilityContext(),
    })
  }
  const admission = acquirePersonRead(personId, 'foreground')
  if (admission.status === 'throttled') {
    return Promise.resolve({
      schedule: unavailable('rate-limited', admission.retryAfterSeconds),
      ...unavailableScheduleAvailabilityContext(),
    })
  }

  activeScheduleReads += 1
  const read = Promise.all([
    loadVolunteerSchedule(personId, now),
    loadVolunteerScheduleAvailabilityContext(personId, now),
  ]).then(([schedule, availability]) => ({
    schedule,
    ...availability,
  })).finally(() => {
    if (serviceOverviewReadsByPerson.get(personId) === read) {
      serviceOverviewReadsByPerson.delete(personId)
    }
    activeScheduleReads = Math.max(0, activeScheduleReads - 1)
  })
  serviceOverviewReadsByPerson.set(personId, read)
  return read
}

export async function getVolunteerScheduleUnavailability(
  personId: number,
  now = new Date(),
): Promise<VolunteerScheduleUnavailabilityListResult> {
  return (await getVolunteerScheduleAvailabilityContext(personId, now)).unavailability
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
