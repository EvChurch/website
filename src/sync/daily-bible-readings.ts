import type { PayloadRequest } from 'payload'

import { getPayloadClient } from '@/lib/payload'
import {
  API_BIBLE_CSB_ABBREVIATION,
  API_BIBLE_CSB_ID,
  API_BIBLE_CSB_TITLE,
  fetchApiBibleCSBPassage,
  type ApiBiblePassage,
} from '@/lib/api-bible'
import {
  fetchDailyBibleReadingCommunications,
  type RockCommunication,
} from '@/lib/rock-api'

import { mapRockDailyBibleReading, type MappedDailyBibleReading } from './mappers/daily-bible-reading'
import type { SyncResult } from './sync-runner'

type ReadingPayload = {
  create(options: {
    collection: 'daily-bible-readings'
    data: Record<string, unknown>
    req: PayloadRequest
  }): Promise<unknown>
  update(options: {
    collection: 'daily-bible-readings'
    id: number | string
    data: Record<string, unknown>
    req: PayloadRequest
  }): Promise<unknown>
  find(options: {
    collection: 'daily-bible-readings'
    depth: 0
    limit: 0
    pagination: false
    req?: PayloadRequest
    select: { rockId: true; passageProvider: true; scriptureFetchedAt: true }
    where: { rockId: { in: number[] } }
  }): Promise<{
    docs: Array<{
      id: number | string
      rockId: number
      passageProvider?: 'api-bible' | null
      scriptureFetchedAt?: string | null
    }>
  }>
  db: {
    beginTransaction(): Promise<number | string | null | undefined>
    commitTransaction(id: number | string): Promise<unknown>
    rollbackTransaction(id: number | string): Promise<unknown>
  }
}

type Dependencies = {
  fetchCommunications?: () => Promise<RockCommunication[]>
  fetchPassage?: (reference: string) => Promise<ApiBiblePassage>
  getPayload?: () => Promise<unknown>
}

export const MAX_API_BIBLE_READINGS_PER_RUN = 18

function apiBibleWritePriority(
  reading: MappedDailyBibleReading,
  existingByRockId: Map<number, {
    passageProvider?: 'api-bible' | null
  }>,
): number {
  const existing = existingByRockId.get(reading.rockId)
  if (!existing) return 0
  return existing.passageProvider === 'api-bible' ? 2 : 1
}

/** Preserves Rock source fields while refreshing expiring API.Bible delivery metadata. */
export async function syncDailyBibleReadings({
  fetchCommunications = fetchDailyBibleReadingCommunications,
  fetchPassage = fetchApiBibleCSBPassage,
  getPayload = getPayloadClient,
}: Dependencies = {}): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'daily-bible-readings',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
    warnings: [],
  }

  try {
    const communications = await fetchCommunications()
    const mapped: MappedDailyBibleReading[] = []
    const validationErrors: string[] = []
    for (const communication of communications) {
      const parsed = mapRockDailyBibleReading(communication)
      if (!parsed.ok) {
        validationErrors.push(
          `Rock communication ${parsed.diagnostic.rockId} failed validation: ${parsed.diagnostic.code}`,
        )
      } else {
        mapped.push(parsed.value)
      }
    }
    result.warnings?.push(...validationErrors)
    if (mapped.length === 0) {
      if (validationErrors.length > 0) {
        result.errors.push('No valid Daily Bible Reading communications were available to import')
      }
      return result
    }

    mapped.sort((left, right) =>
      left.rockSentAt.localeCompare(right.rockSentAt) || left.rockId - right.rockId,
    )

    const payload = (await getPayload()) as ReadingPayload
    const existing = await payload.find({
      collection: 'daily-bible-readings',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { rockId: true, passageProvider: true, scriptureFetchedAt: true },
      where: { rockId: { in: mapped.map(({ rockId }) => rockId) } },
    })
    const existingByRockId = new Map(existing.docs.map((reading) => [reading.rockId, reading]))
    const refreshBefore = Date.now() - (13 * 24 * 60 * 60 * 1000)
    const pendingReadings = mapped.filter((reading) => {
      const cached = existingByRockId.get(reading.rockId)
      if (cached?.passageProvider !== 'api-bible' || !cached.scriptureFetchedAt) return true
      const fetchedAt = Date.parse(cached.scriptureFetchedAt)
      return !Number.isFinite(fetchedAt) || fetchedAt <= refreshBefore
    })
    const readingsToWrite = [...pendingReadings]
      .sort((left, right) =>
        apiBibleWritePriority(left, existingByRockId) - apiBibleWritePriority(right, existingByRockId) ||
        right.rockSentAt.localeCompare(left.rockSentAt) ||
        right.rockId - left.rockId,
      )
      .slice(0, MAX_API_BIBLE_READINGS_PER_RUN)
    const deferredCount = pendingReadings.length - readingsToWrite.length
    if (deferredCount > 0) {
      result.warnings?.push(
        `${deferredCount} Daily Bible Reading API.Bible refreshes were deferred to a later sync run`,
      )
    }
    if (readingsToWrite.length === 0) return result

    // Complete external reads before the transaction and keep them sequential for provider limits.
    const scriptureByRockId = new Map<number, ApiBiblePassage>()
    const failedApiBibleRockIds: number[] = []
    for (const reading of readingsToWrite) {
      try {
        scriptureByRockId.set(reading.rockId, await fetchPassage(reading.passageReference))
      } catch (error) {
        failedApiBibleRockIds.push(reading.rockId)
        result.warnings?.push(
          `Rock communication ${reading.rockId} could not load ${reading.passageReference} from API.Bible: ${String(error)}`,
        )
      }
    }
    const readableToWrite = readingsToWrite.filter(({ rockId }) => scriptureByRockId.has(rockId))
    if (readableToWrite.length === 0) {
      result.errors.push('API.Bible passage retrieval failed for every pending Daily Bible Reading')
      return result
    }

    const transactionID = await payload.db.beginTransaction()
    if (transactionID === null || transactionID === undefined) {
      throw new Error('Payload database transactions are required for Daily Bible Reading imports')
    }
    const req = { transactionID } as PayloadRequest

    try {
      const importedAt = new Date().toISOString()
      for (const reading of readableToWrite) {
        const scripture = scriptureByRockId.get(reading.rockId)
        if (!scripture) throw new Error(`Missing API.Bible passage for Rock communication ${reading.rockId}`)
        const scriptureData = {
          passageText: scripture.content,
          passageProvider: 'api-bible',
          bibleVersionId: API_BIBLE_CSB_ID,
          bibleVersionAbbreviation: API_BIBLE_CSB_ABBREVIATION,
          bibleVersionTitle: API_BIBLE_CSB_TITLE,
          apiBiblePassageId: scripture.id,
          apiBibleFumsToken: scripture.fumsToken,
          bibleCopyright: scripture.copyright,
          scriptureFetchedAt: importedAt,
        }
        const existingReading = existingByRockId.get(reading.rockId)
        if (existingReading) {
          await payload.update({
            collection: 'daily-bible-readings',
            id: existingReading.id,
            req,
            data: scriptureData,
          })
          result.updated++
          continue
        }
        await payload.create({
          collection: 'daily-bible-readings',
          req,
          data: {
            ...reading,
            ...scriptureData,
            sourceDate: `${reading.sourceDate}T00:00:00.000+12:00`,
            questions: reading.questions.map((text) => ({ text })),
            prayerPrompts: reading.prayerPrompts.map((text) => ({ text })),
            isPublished: true,
            importedAt,
          },
        })
        result.created++
      }
      await payload.db.commitTransaction(transactionID)
      if (failedApiBibleRockIds.length > 0) {
        result.errors.push(
          `API.Bible passage retrieval failed for Rock communications: ${failedApiBibleRockIds.join(', ')}`,
        )
      }
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      result.created = 0
      result.updated = 0
      throw error
    }
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}
