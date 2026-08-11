import { JSDOM } from 'jsdom'

import { toApiBiblePassageId } from '@/lib/api-bible'
import type { RockCommunication } from '@/lib/rock-api'

export const DAILY_BIBLE_READING_LIST_GROUP_ID = 28916
export const DAILY_BIBLE_READING_SUBJECT = 'A Word from God for you today'
export const ROCK_COMMUNICATION_SENT_STATUS = 3

export type DailyBibleReadingRejection =
  | 'wrong-list'
  | 'wrong-subject'
  | 'not-sent'
  | 'missing-sent-at'

export type DailyBibleReadingDiagnosticCode =
  | 'ineligible'
  | 'missing-body'
  | 'missing-opening-scripture'
  | 'missing-passage'
  | 'ambiguous-section'
  | 'invalid-sent-at'

export type MappedDailyBibleReading = {
  rockId: number
  rockGuid: string
  sourceName: string
  subject: string
  rockSentAt: string
  sourceDate: string
  openingScripture: string
  passageReference: string
  passageText: string
  questions: string[]
  prayerPrompts: string[]
}

export type DailyBibleReadingMapResult =
  | { ok: true; value: MappedDailyBibleReading }
  | {
      ok: false
      diagnostic: { rockId: number; code: DailyBibleReadingDiagnosticCode }
    }

export function classifyDailyBibleReadingCommunication(
  communication: RockCommunication,
): { eligible: true } | { eligible: false; reason: DailyBibleReadingRejection } {
  if (communication.ListGroupId !== DAILY_BIBLE_READING_LIST_GROUP_ID) {
    return { eligible: false, reason: 'wrong-list' }
  }
  if (normalizeText(communication.Subject) !== DAILY_BIBLE_READING_SUBJECT) {
    return { eligible: false, reason: 'wrong-subject' }
  }
  if (communication.Status !== ROCK_COMMUNICATION_SENT_STATUS) {
    return { eligible: false, reason: 'not-sent' }
  }
  if (!communication.SendDateTime) {
    return { eligible: false, reason: 'missing-sent-at' }
  }
  return { eligible: true }
}

export function mapRockDailyBibleReading(
  communication: RockCommunication,
): DailyBibleReadingMapResult {
  if (!classifyDailyBibleReadingCommunication(communication).eligible) {
    return failure(communication.Id, 'ineligible')
  }
  if (!communication.Message?.trim()) return failure(communication.Id, 'missing-body')

  const document = new JSDOM(communication.Message).window.document
  const headings = [...document.querySelectorAll('h1')]
  const sections = new Map<string, Element>()
  for (const heading of headings) {
    const headingName = normalizeText(heading.textContent).toLowerCase()
    const name = headingName === 'passages' ? 'passage' : headingName
    if (!['passage', 'questions', 'pray'].includes(name)) continue
    if (sections.has(name)) return failure(communication.Id, 'ambiguous-section')
    sections.set(name, heading)
  }

  const openingHeadings = [...document.querySelectorAll('h3')]
    .map((element) => normalizeText(element.textContent))
    .filter(Boolean)
  if (openingHeadings.length !== 1) {
    return failure(communication.Id, 'missing-opening-scripture')
  }

  const passageHeading = sections.get('passage')
  if (!passageHeading) return failure(communication.Id, 'missing-passage')
  const passageParts = sectionItems(passageHeading)
  const passageReferences = passageParts.filter(isPassageReference)
  const passageTextParts = passageParts.filter((part) => !isPassageReference(part))
  if (passageReferences.length === 0 || passageTextParts.length === 0) {
    return failure(communication.Id, 'missing-passage')
  }

  const sent = rockSentDateTime(communication.SendDateTime as string)
  if (!sent) return failure(communication.Id, 'invalid-sent-at')

  return {
    ok: true,
    value: {
      rockId: communication.Id,
      rockGuid: communication.Guid.trim().toLowerCase(),
      sourceName: normalizeText(communication.Name),
      subject: DAILY_BIBLE_READING_SUBJECT,
      rockSentAt: sent.instant,
      sourceDate: sent.sourceDate,
      openingScripture: openingHeadings[0],
      passageReference: passageReferences.join('; '),
      passageText: passageTextParts.join('\n\n'),
      questions: optionalSectionItems(sections.get('questions')),
      prayerPrompts: optionalSectionItems(sections.get('pray')),
    },
  }
}

function isPassageReference(value: string): boolean {
  try {
    toApiBiblePassageId(value)
    return true
  } catch {
    return false
  }
}

function optionalSectionItems(heading: Element | undefined): string[] {
  return heading ? sectionItems(heading) : []
}

function sectionItems(heading: Element): string[] {
  const items: string[] = []
  let collecting = false
  for (const element of heading.ownerDocument.querySelectorAll('h1,p,li')) {
    if (element === heading) {
      collecting = true
      continue
    }
    if (!collecting) continue
    if (element.tagName === 'H1') break
    if (element.tagName === 'P' && element.closest('li')) continue
    const value = normalizeText(element.textContent)
    if (value) items.push(value)
  }
  return items
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function failure(rockId: number, code: DailyBibleReadingDiagnosticCode): DailyBibleReadingMapResult {
  return { ok: false, diagnostic: { rockId, code } }
}

function rockSentDateTime(value: string): { instant: string; sourceDate: string } | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/,
  )
  if (!match) {
    const instant = new Date(value)
    if (Number.isNaN(instant.getTime())) return null
    return {
      instant: instant.toISOString(),
      sourceDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Pacific/Auckland',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(instant),
    }
  }

  const [, year, month, day, hour, minute, second, millisecond = '0'] = match
  const localParts = [year, month, day, hour, minute, second].map(Number)
  const utcGuess = Date.UTC(
    localParts[0], localParts[1] - 1, localParts[2], localParts[3], localParts[4], localParts[5],
    Number(millisecond.padEnd(3, '0')),
  )
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(utcGuess)).map(({ type, value: part }) => [type, part]),
  )
  const represented = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour),
    Number(parts.minute), Number(parts.second), Number(millisecond.padEnd(3, '0')),
  )
  const instant = new Date(utcGuess - (represented - utcGuess))
  return { instant: instant.toISOString(), sourceDate: `${year}-${month}-${day}` }
}
