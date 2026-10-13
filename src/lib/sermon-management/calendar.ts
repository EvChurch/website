import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import type { SermonSetting } from '@/payload-types'
import type { SermonMetadata } from './workflow'
import { driveToken, relationID } from './drive'

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()
const key = (text: string) => clean(text).toLowerCase()
export function recordingDate(filename: string) {
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!match) return undefined
  const date = `${match[1]}-${match[2]}-${match[3]}`
  return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : undefined
}
export function calendarDate(value: string) {
  const match = value.match(/\b(\d{1,2})[- /]([A-Za-z]{3})[- /](\d{4})\b/)
  if (!match) return /^\d{4}-\d{2}-\d{2}$/.test(value) ? recordingDate(value.replaceAll('-', '')) : undefined
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[2].toLowerCase()) + 1
  return month ? recordingDate(`${match[3]}${String(month).padStart(2, '0')}${match[1].padStart(2, '0')}`) : undefined
}
export function spreadsheetID(value: string) {
  const id = value.match(/^https:\/\/docs.google.com\/spreadsheets\/d\/([\w-]+)/)?.[1] || value
  if (!/^[\w-]+$/.test(id)) throw new Error('Invalid teaching calendar spreadsheet.')
  return id
}
export function calendarRow(rows: string[][], date: string, column: string) {
  if (!/^[A-Z]{1,2}$/.test(column)) throw new Error('Choose a valid calendar date column.')
  const index = [...column].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
  const matches = rows.slice(1).filter(row => calendarDate(row[index] || '') === date)
  if (matches.length !== 1) throw new Error(matches.length ? 'Multiple calendar entries match this date. Enter the sermon details manually.' : 'No calendar entry matches this recording date. Enter the sermon details manually.')
  return (header: string) => {
    const indexes = rows[0].flatMap((cell, i) => key(cell) === key(header) ? [i] : [])
    if (indexes.length !== 1) throw new Error(`Check the calendar column mapping for ${header}.`)
    return clean(matches[0][indexes[0]] || '')
  }
}

export async function calendarDefaults(payload: Payload, settings: SermonSetting, filename: string, campus: number, req?: PayloadRequest): Promise<{ metadata: Partial<SermonMetadata>; notice: string }> {
  const date = recordingDate(filename)
  const metadata: Partial<SermonMetadata> = { audioCampus: campus, ...(date ? { publishedAt: date } : {}) }
  if (!date) return { metadata, notice: 'No valid service date found at the start of the filename. Enter the details manually.' }
  const config = settings.calendar
  if (!config?.spreadsheetId || !config.worksheet) return { metadata, notice: 'Teaching calendar is not configured. Enter the details manually.' }
  try {
    const range = `'${config.worksheet.replaceAll("'", "''")}'!A1:AZ1000`
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetID(config.spreadsheetId)}/values/${encodeURIComponent(range)}`, {
      headers: { Authorization: `Bearer ${await driveToken()}` }, cache: 'no-store', signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) return { metadata, notice: 'Unable to read the teaching calendar. Check the file, worksheet and Google access, or enter the details manually.' }
    const data = await response.json() as { values?: string[][] }
    const cell = calendarRow(data.values || [], date, config.dateColumn || 'B')
    const campusMappings = config.campuses?.filter(row => relationID(row.campus) === campus) || []
    if (campusMappings.length !== 1) return { metadata, notice: 'Map this campus to its calendar preacher column in Sermon Settings.' }
    const title = cell(config.titleHeader || 'Sunday Topic')
    const seriesTitle = cell(config.seriesHeader || 'Series')
    const passage = cell(config.passageHeader || 'Bible Reading')
    const preacher = cell(campusMappings[0].preacherHeader)
    // Resolve every configured column before making any taxonomy changes.
    metadata.title = title
    metadata.passageReference = /[a-z]\s+\d/i.test(passage) ? passage : ''
    const mappings = config.speakers?.filter(row => key(row.label) === key(preacher)) || []
    metadata.audioSpeaker = mappings.length === 1 ? relationID(mappings[0].speaker) : undefined
    let seriesNotice = ''
    if (seriesTitle) {
      try {
        metadata.series = [await resolveCalendarSeries(payload, seriesTitle, req, date)]
      } catch (error) {
        if (!(error instanceof AmbiguousCalendarSeries)) throw error
        metadata.series = []
        seriesNotice = ' Choose a series: the calendar label and sermon date do not identify a single series.'
      }
    } else metadata.series = []
    const books = await payload.find({ collection: 'scriptures', depth: 0, limit: 100, req, select: { name: true } })
    metadata.scriptures = books.docs.filter(book => new RegExp(`(?:^|[;\\n])\\s*${book.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\d`, 'i').test(passage)).map(book => book.id)
    return { metadata, notice: `Calendar defaults loaded for ${date}.${seriesNotice}${metadata.audioSpeaker ? '' : ` Map preacher “${preacher || '(blank)'}” in Sermon Settings or choose a speaker.`}${metadata.passageReference ? '' : ' Check the Bible passage.'}` }
  } catch {
    return { metadata: { audioCampus: campus, publishedAt: date }, notice: 'Calendar entry is missing, ambiguous or its columns have changed. Check Sermon Settings or enter details manually.' }
  }
}

export async function resolveCalendarSeries(payload: Payload, title: string, parentReq?: PayloadRequest, sermonDate?: string) {
  const existingTransaction = parentReq && await parentReq.transactionID
  const transactionID = existingTransaction ?? await payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Series resolution requires transactions.')
  const req = existingTransaction ? parentReq! : await createLocalReq({ req: { transactionID, context: { skipCacheInvalidation: true } } }, payload)
  try {
    const session = payload.db.sessions?.[transactionID] as { db: { execute(query: ReturnType<typeof sql>): Promise<unknown> } } | undefined
    if (!session) throw new Error('Database transaction unavailable.')
    await session.db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`sermon-series:${key(title)}`}))`)
    const series = await payload.find({ collection: 'sermon-series', depth: 0, pagination: false, limit: 2000, req, select: { title: true } })
    const matches = series.docs.filter(row => calendarSeriesNameMatches(row.title, title))
    const dated = await Promise.all(matches.map(async row => {
      const sermons = await payload.find({ collection: 'sermons', depth: 0, limit: 1, sort: 'publishedAt', req,
        where: { and: [{ series: { contains: row.id } }, { isPublished: { equals: true } }, { publishedAt: { exists: true } }] },
        select: { publishedAt: true },
      })
      return { ...row, startDate: sermons.docs[0]?.publishedAt?.slice(0, 10) }
    }))
    const matched = chooseCalendarSeries(dated, sermonDate)
    const selected = matched || await payload.create({ collection: 'sermon-series', req, data: { title: clean(title), slug: '' } })
    if (!existingTransaction) await payload.db.commitTransaction(transactionID)
    return selected.id
  } catch (error) {
    if (!existingTransaction) await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

class AmbiguousCalendarSeries extends Error {}

export function calendarSeriesNameMatches(seriesTitle: string, calendarLabel: string) {
  return key(seriesTitle) === key(calendarLabel) || key(seriesTitle.split(/[:–—]/)[0]) === key(calendarLabel)
}

/** A short calendar label selects the most recently begun matching series, never a future run. */
export function chooseCalendarSeries<T extends { id: number; startDate?: string | null }>(matches: T[], sermonDate?: string): T | undefined {
  if (!matches.length) return undefined
  if (!sermonDate) {
    if (matches.length === 1) return matches[0]
    throw new AmbiguousCalendarSeries('Multiple series match the calendar label.')
  }
  const dated = matches.filter(row => row.startDate && row.startDate <= sermonDate).sort((a, b) => b.startDate!.localeCompare(a.startDate!))
  if (dated.length && (dated.length === 1 || dated[0].startDate !== dated[1].startDate)) return dated[0]
  if (!dated.length && matches.length === 1 && !matches[0].startDate) return matches[0]
  throw new AmbiguousCalendarSeries('No unique series start matches the sermon date.')
}
