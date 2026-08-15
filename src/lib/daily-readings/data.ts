import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getPayloadClient } from '@/lib/payload'

export interface DailyReadingView {
  id: number
  rockId: number
  sourceName: string
  sourceDate: string
  rockSentAt: string
  openingScripture: string
  passageReference: string
  passageText: string
  bibleVersionAbbreviation: string | null
  bibleVersionTitle: string | null
  apiBibleFumsToken: string | null
  bibleCopyright: string | null
  questions: string[]
  prayerPrompts: string[]
}

function toView(reading: {
  id: number
  rockId: number
  sourceName: string
  sourceDate: string
  rockSentAt: string
  openingScripture: string
  passageReference: string
  passageText?: string
  bibleVersionAbbreviation?: string | null
  bibleVersionTitle?: string | null
  apiBibleFumsToken?: string | null
  bibleCopyright?: string | null
  questions?: { text: string }[] | null
  prayerPrompts?: { text: string }[] | null
}): DailyReadingView {
  return {
    id: reading.id,
    rockId: reading.rockId,
    sourceName: reading.sourceName,
    sourceDate: reading.sourceDate,
    rockSentAt: reading.rockSentAt,
    openingScripture: reading.openingScripture,
    passageReference: reading.passageReference,
    passageText: reading.passageText ?? '',
    bibleVersionAbbreviation: reading.bibleVersionAbbreviation ?? null,
    bibleVersionTitle: reading.bibleVersionTitle ?? null,
    apiBibleFumsToken: reading.apiBibleFumsToken ?? null,
    bibleCopyright: reading.bibleCopyright ?? null,
    questions: reading.questions?.map(({ text }) => text) ?? [],
    prayerPrompts: reading.prayerPrompts?.map(({ text }) => text) ?? [],
  }
}

async function fetchPublishedDailyReadings(limit: number): Promise<DailyReadingView[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'daily-bible-readings',
    where: { isPublished: { equals: true } },
    sort: '-rockSentAt',
    limit,
    depth: 0,
    select: {
      rockId: true,
      sourceName: true,
      sourceDate: true,
      rockSentAt: true,
      openingScripture: true,
      passageReference: true,
      questions: true,
      prayerPrompts: true,
    },
  })

  return result.docs.map(toView)
}

const getCachedPublishedDailyReadings = unstable_cache(
  fetchPublishedDailyReadings,
  ['published-daily-readings'],
  { tags: [CACHE_TAGS.dailyBibleReadings], revalidate: 3_600 },
)

export async function getPublishedDailyReadings(limit = 400): Promise<DailyReadingView[]> {
  return getCachedPublishedDailyReadings(limit)
}

export async function getLatestDailyReading(): Promise<DailyReadingView | null> {
  return (await getPublishedDailyReadings(1))[0] ?? null
}

async function fetchDailyReadingByRockId(rockId: number): Promise<DailyReadingView | null> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'daily-bible-readings',
    where: {
      and: [
        { rockId: { equals: rockId } },
        { isPublished: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    select: {
      rockId: true,
      sourceName: true,
      sourceDate: true,
      rockSentAt: true,
      openingScripture: true,
      passageReference: true,
      passageText: true,
      bibleVersionAbbreviation: true,
      bibleVersionTitle: true,
      apiBibleFumsToken: true,
      bibleCopyright: true,
      questions: true,
      prayerPrompts: true,
    },
  })

  const reading = result.docs[0]
  return reading ? toView(reading) : null
}

const getCachedDailyReadingByRockId = unstable_cache(
  fetchDailyReadingByRockId,
  ['daily-reading-by-rock-id'],
  { tags: [CACHE_TAGS.dailyBibleReadings], revalidate: 3_600 },
)

export const getDailyReadingByRockId = cache(getCachedDailyReadingByRockId)

export function formatReadingDate(value: string, options?: { weekday?: boolean }): string {
  return new Date(value).toLocaleDateString('en-NZ', {
    ...(options?.weekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  })
}

export function readingDateKey(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${values.year}-${values.month}-${values.day}`
}
