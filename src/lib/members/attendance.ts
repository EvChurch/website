import { unstable_cache } from 'next/cache'

import { rockFetchAll } from '@/lib/rock-api'

export interface RockAttendanceOccurrence {
  Id: number
  GroupId?: number | null
  RootGroupTypeId?: number | null
  OccurrenceDate?: string | null
  DidNotOccur?: boolean | null
}

export interface RockAttendanceRecord {
  Id: number
  DidAttend?: boolean | null
  PersonAliasId?: number | null
  OccurrenceId?: number | null
  StartDateTime?: string | null
}

interface RockPersonAlias {
  Id: number
  PersonId?: number | null
}

interface RockGroupType {
  Id: number
}

const ATTENDANCE_REQUEST_OPTIONS = {
  retries: 0,
  timeoutMs: 5_000,
} as const

export interface AttendanceMark {
  date: string
  didAttend: boolean
}

export interface AttendanceSeries {
  recent: AttendanceMark[]
  ytdPercentage: number | null
  missedInARow: number
}

export interface PersonAttendanceSummary {
  connectGroup: AttendanceSeries
  church: AttendanceSeries
  needsAttention: boolean
  attentionLabel: string | null
}

export interface GroupAttendanceOverview {
  people: Record<number, PersonAttendanceSummary>
  summary: {
    connectGroup: { recentPercentage: number | null; ytdPercentage: number | null }
    church: { recentPercentage: number | null; ytdPercentage: number | null }
  }
  monthly: Array<{
    month: string
    connectGroupPercentage: number | null
    churchPercentage: number | null
  }>
}

function dateKey(value: string | null | undefined): string | null {
  const candidate = value?.slice(0, 10)
  return candidate && /^\d{4}-\d{2}-\d{2}$/u.test(candidate) ? candidate : null
}

function yearStart(now: Date) {
  return `${now.getUTCFullYear()}-01-01`
}

function percentage(marks: AttendanceMark[]): number | null {
  if (marks.length === 0) return null
  return Math.round((marks.filter((mark) => mark.didAttend).length / marks.length) * 100)
}

function missedInARow(marks: AttendanceMark[]): number {
  let missed = 0
  for (let index = marks.length - 1; index >= 0; index--) {
    if (marks[index]?.didAttend) break
    missed++
  }
  return missed
}

function series(marks: AttendanceMark[]): AttendanceSeries {
  return {
    recent: marks.slice(-4),
    ytdPercentage: percentage(marks),
    missedInARow: missedInARow(marks),
  }
}

function attendanceMarksByPerson(
  attendances: RockAttendanceRecord[],
  aliasesById: Map<number, number>,
  occurrencesById: Map<number, RockAttendanceOccurrence>,
): Map<number, AttendanceMark[]> {
  const byPerson = new Map<number, Map<string, boolean>>()
  for (const attendance of attendances) {
    const personId = attendance.PersonAliasId
      ? aliasesById.get(attendance.PersonAliasId)
      : null
    if (!personId) continue
    const occurrence = attendance.OccurrenceId
      ? occurrencesById.get(attendance.OccurrenceId)
      : null
    if (attendance.OccurrenceId && !occurrence) continue
    const date = dateKey(occurrence?.OccurrenceDate ?? attendance.StartDateTime)
    if (!date) continue
    const byDate = byPerson.get(personId) ?? new Map<string, boolean>()
    byDate.set(date, byDate.get(date) === true || attendance.DidAttend === true)
    byPerson.set(personId, byDate)
  }
  return new Map(
    [...byPerson.entries()].map(([personId, byDate]) => [
      personId,
      [...byDate.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, didAttend]) => ({ date, didAttend })),
    ]),
  )
}

function churchMarks(
  recordedMarks: AttendanceMark[],
  groupMarks: AttendanceMark[],
  occurrenceDates: string[],
): AttendanceMark[] {
  const recorded = new Map(recordedMarks.map((mark) => [mark.date, mark.didAttend]))
  const activeSince = [recordedMarks[0]?.date, groupMarks[0]?.date]
    .filter((date): date is string => !!date)
    .sort()[0]
  if (!activeSince) return []
  return occurrenceDates.filter((date) => date >= activeSince).map((date) => ({
    date,
    didAttend: recorded.get(date) === true,
  }))
}

function attentionLabel(connectGroupMisses: number, churchMisses: number): string | null {
  const labels: string[] = []
  if (connectGroupMisses >= 2) labels.push(`${connectGroupMisses} CGs missed`)
  if (churchMisses >= 2) labels.push(`${churchMisses} Sundays missed`)
  return labels.length > 0 ? labels.join(' · ') : null
}

function aggregateSummary(allMarks: AttendanceMark[]) {
  const dates = [...new Set(allMarks.map((mark) => mark.date))].sort()
  const recentDates = new Set(dates.slice(-4))
  return {
    recentPercentage: percentage(allMarks.filter((mark) => recentDates.has(mark.date))),
    ytdPercentage: percentage(allMarks),
  }
}

function recentMonthKeys(now: Date): string[] {
  const keys: string[] = []
  const year = now.getUTCFullYear()
  for (let offset = 5; offset >= 0; offset--) {
    const month = new Date(Date.UTC(year, now.getUTCMonth() - offset, 1))
    if (month.getUTCFullYear() !== year) continue
    keys.push(month.toISOString().slice(0, 7))
  }
  return keys
}

export function buildAttendanceOverview({
  rockPersonIds,
  groupOccurrences,
  churchOccurrences,
  personAliases,
  groupAttendances,
  churchAttendances,
  now = new Date(),
}: {
  rockPersonIds: number[]
  groupOccurrences: RockAttendanceOccurrence[]
  churchOccurrences?: RockAttendanceOccurrence[]
  personAliases?: RockPersonAlias[]
  groupAttendances: RockAttendanceRecord[]
  churchAttendances: RockAttendanceRecord[]
  now?: Date
}): GroupAttendanceOverview {
  const today = now.toISOString().slice(0, 10)
  const start = yearStart(now)
  const usableOccurrences = (occurrences: RockAttendanceOccurrence[]) => new Map(
    occurrences
      .filter((occurrence) => occurrence.DidNotOccur !== true)
      .filter((occurrence) => {
        const date = dateKey(occurrence.OccurrenceDate)
        return !!date && date >= start && date < today
      })
      .map((occurrence) => [occurrence.Id, occurrence]),
  )
  const groupOccurrencesById = usableOccurrences(groupOccurrences)
  const churchOccurrencesById = usableOccurrences(churchOccurrences ?? groupOccurrences)
  const churchOccurrenceDates = [...new Set(
    [...churchOccurrencesById.values()]
      .map((occurrence) => dateKey(occurrence.OccurrenceDate))
      .filter((date): date is string => !!date),
  )].sort()
  const aliasesById = new Map(
    (personAliases ?? rockPersonIds.map((personId) => ({ Id: personId, PersonId: personId })))
      .flatMap((alias) => alias.PersonId ? [[alias.Id, alias.PersonId] as const] : []),
  )
  const people: Record<number, PersonAttendanceSummary> = {}
  const allGroupMarks: AttendanceMark[] = []
  const allChurchMarks: AttendanceMark[] = []
  const groupMarksByPerson = attendanceMarksByPerson(
    groupAttendances,
    aliasesById,
    groupOccurrencesById,
  )
  const churchMarksByPerson = attendanceMarksByPerson(
    churchAttendances,
    aliasesById,
    churchOccurrencesById,
  )

  for (const personId of rockPersonIds) {
    const personGroupMarks = groupMarksByPerson.get(personId) ?? []
    const personChurchMarks = churchMarks(
      churchMarksByPerson.get(personId) ?? [],
      personGroupMarks,
      churchOccurrenceDates,
    )
    const connectGroup = series(personGroupMarks)
    const church = series(personChurchMarks)
    const label = attentionLabel(connectGroup.missedInARow, church.missedInARow)
    people[personId] = {
      connectGroup,
      church,
      needsAttention: label !== null,
      attentionLabel: label,
    }
    allGroupMarks.push(...personGroupMarks)
    allChurchMarks.push(...personChurchMarks)
  }

  const monthly = recentMonthKeys(now).map((month) => ({
    month,
    connectGroupPercentage: percentage(
      allGroupMarks.filter((mark) => mark.date.startsWith(month)),
    ),
    churchPercentage: percentage(
      allChurchMarks.filter((mark) => mark.date.startsWith(month)),
    ),
  }))

  return {
    people,
    summary: {
      connectGroup: aggregateSummary(allGroupMarks),
      church: aggregateSummary(allChurchMarks),
    },
    monthly,
  }
}

function equalityFilter(field: string, ids: number[]) {
  return ids.map((id) => `${field} eq ${id}`).join(' or ')
}

function chunks<T>(values: T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  )
}

const fetchWeekendAttendanceOccurrences = unstable_cache(
  async (start: string) => {
    const weekendGroupTypes = await rockFetchAll<RockGroupType>({
      endpoint: 'GroupTypes',
      getKey: (groupType) => groupType.Id,
      params: {
        $filter: 'AttendanceCountsAsWeekendService eq true',
        $select: 'Id',
      },
      ...ATTENDANCE_REQUEST_OPTIONS,
    })
    const weekendGroupTypeIds = weekendGroupTypes.map((groupType) => groupType.Id)
    if (weekendGroupTypeIds.length === 0) return []
    return rockFetchAll<RockAttendanceOccurrence>({
      endpoint: 'AttendanceOccurrences',
      getKey: (occurrence) => occurrence.Id,
      params: {
        $filter: `OccurrenceDate ge datetime'${start}' and (${equalityFilter('RootGroupTypeId', weekendGroupTypeIds)})`,
        $orderby: 'OccurrenceDate,Id',
        $select: 'Id,GroupId,RootGroupTypeId,OccurrenceDate,DidNotOccur',
      },
      ...ATTENDANCE_REQUEST_OPTIONS,
    })
  },
  ['connect-group-weekend-attendance-occurrences'],
  { revalidate: 300 },
)

export async function fetchConnectGroupAttendance(
  rockGroupId: number,
  rockPersonIds: number[],
  now = new Date(),
): Promise<GroupAttendanceOverview> {
  if (!Number.isSafeInteger(rockGroupId) || rockGroupId <= 0) {
    throw new Error('Connect Group attendance requires a durable group Id')
  }
  const personIds = [...new Set(rockPersonIds)]
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .sort((left, right) => left - right)
  if (personIds.length === 0) {
    return buildAttendanceOverview({
      rockPersonIds: [],
      groupOccurrences: [],
      churchOccurrences: [],
      personAliases: [],
      groupAttendances: [],
      churchAttendances: [],
      now,
    })
  }

  const start = `${yearStart(now)}T00:00:00`
  const [personAliases, groupOccurrences, churchOccurrences] = await Promise.all([
    rockFetchAll<RockPersonAlias>({
      endpoint: 'PersonAlias',
      getKey: (alias) => alias.Id,
      params: {
        $filter: `(${equalityFilter('PersonId', personIds)})`,
        $select: 'Id,PersonId',
      },
      ...ATTENDANCE_REQUEST_OPTIONS,
    }),
    rockFetchAll<RockAttendanceOccurrence>({
      endpoint: 'AttendanceOccurrences',
      getKey: (occurrence) => occurrence.Id,
      params: {
        $filter: `GroupId eq ${rockGroupId} and OccurrenceDate ge datetime'${start}'`,
        $orderby: 'OccurrenceDate,Id',
        $select: 'Id,GroupId,RootGroupTypeId,OccurrenceDate,DidNotOccur',
      },
      ...ATTENDANCE_REQUEST_OPTIONS,
    }),
    fetchWeekendAttendanceOccurrences(start),
  ])
  const aliasIds = personAliases.map((alias) => alias.Id)
  if (aliasIds.length === 0) {
    return buildAttendanceOverview({
      rockPersonIds: personIds,
      groupOccurrences,
      churchOccurrences,
      personAliases,
      groupAttendances: [],
      churchAttendances: [],
      now,
    })
  }

  const attendancePages = await Promise.all([
    ...chunks(aliasIds, 15).map((aliasIdChunk) => rockFetchAll<RockAttendanceRecord>({
      endpoint: 'Attendances',
      getKey: (attendance) => attendance.Id,
      params: {
        $filter: `StartDateTime ge datetime'${start}' and (${equalityFilter('PersonAliasId', aliasIdChunk)})`,
        $orderby: 'StartDateTime,Id',
        $select: 'Id,DidAttend,PersonAliasId,OccurrenceId,StartDateTime',
      },
      ...ATTENDANCE_REQUEST_OPTIONS,
    })),
  ])
  const attendances = attendancePages.flat()

  const groupOccurrenceIds = new Set(groupOccurrences.map((occurrence) => occurrence.Id))
  const churchOccurrenceIds = new Set(churchOccurrences.map((occurrence) => occurrence.Id))

  return buildAttendanceOverview({
    rockPersonIds: personIds,
    groupOccurrences,
    churchOccurrences,
    personAliases,
    groupAttendances: attendances.filter((attendance) => (
      attendance.OccurrenceId ? groupOccurrenceIds.has(attendance.OccurrenceId) : false
    )),
    churchAttendances: attendances.filter((attendance) => (
      attendance.OccurrenceId ? churchOccurrenceIds.has(attendance.OccurrenceId) : false
    )),
    now,
  })
}
