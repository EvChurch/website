import { apiBibleFumsTokens } from '@/lib/api-bible-fums'
import type { DailyReadingView } from './data'
import { parsePassageVerses } from './passage'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'X-Robots-Tag': 'noindex',
  // Use the sync-invalidated data cache, without an additional HTTP cache.
  'Cache-Control': 'no-store',
}

export function readingSummary(reading: DailyReadingView) {
  return {
    id: reading.rockId,
    title: reading.sourceName,
    date: reading.sourceDate,
    publishedAt: reading.rockSentAt,
    openingScripture: reading.openingScripture,
    passageReference: reading.passageReference,
    questions: reading.questions,
    prayerPrompts: reading.prayerPrompts,
  }
}

export function readingDetail(reading: DailyReadingView) {
  return {
    ...readingSummary(reading),
    passageVerses: parsePassageVerses(reading.passageText),
    bibleVersionAbbreviation: reading.bibleVersionAbbreviation,
    bibleVersionTitle: reading.bibleVersionTitle,
    bibleCopyright: reading.bibleCopyright,
    apiBibleFumsTokens: apiBibleFumsTokens(reading.apiBibleFumsToken ?? ''),
  }
}

export function readingResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers })
}

export function readingOptions() {
  return new Response(null, { status: 204, headers })
}
