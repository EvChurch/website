import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import type { RockCommunication } from '@/lib/rock-api'

import {
  MAX_API_BIBLE_READINGS_PER_RUN,
  syncDailyBibleReadings,
} from './daily-bible-readings'

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/dbr-2026-08-10.html', import.meta.url)),
  'utf8',
)

describe('syncDailyBibleReadings', () => {
  it('imports each Rock identity once while its API.Bible cache is fresh', async () => {
    const records: ReadingRecord[] = []
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      records.push({
        id: records.length + 1,
        rockId: data.rockId as number,
        passageProvider: data.passageProvider as 'api-bible',
        scriptureFetchedAt: data.scriptureFetchedAt as string,
      })
    })
    const payload = payloadStub(records, create)
    const fetchPassage = vi.fn().mockResolvedValue(apiBiblePassage())
    const dependencies = {
      fetchCommunications: vi.fn().mockResolvedValue([communication()]),
      fetchPassage,
      getPayload: vi.fn().mockResolvedValue(payload),
    }

    await expect(syncDailyBibleReadings(dependencies)).resolves.toMatchObject({ created: 1, errors: [] })
    await expect(syncDailyBibleReadings(dependencies)).resolves.toMatchObject({ created: 0, errors: [] })

    expect(create).toHaveBeenCalledOnce()
    expect(fetchPassage).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'daily-bible-readings',
      data: expect.objectContaining({
        rockId: 16159,
        passageReference: 'Hebrews 5:11-6:20',
        passageText: 'CSB passage from API.Bible',
        passageProvider: 'api-bible',
        bibleVersionId: 'a556c5305ee15c3f-01',
        bibleVersionAbbreviation: 'CSB',
        apiBiblePassageId: 'HEB.5.11-HEB.6.20',
        apiBibleFumsToken: 'fums-token',
        bibleCopyright: 'Christian Standard Bible copyright notice',
        questions: [
          { text: 'How would you summarise the warning of this passage?' },
          { text: 'Why is the author “confident of better things” (6:9) regarding these people?' },
          { text: 'How do you tend to respond to warnings like this?' },
        ],
      }),
    }))
  })

  it('skips malformed legacy candidates without blocking valid readings', async () => {
    const records: ReadingRecord[] = []
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      records.push({
        id: records.length + 1,
        rockId: data.rockId as number,
        passageProvider: data.passageProvider as 'api-bible',
        scriptureFetchedAt: data.scriptureFetchedAt as string,
      })
    })
    const getPayload = vi.fn().mockResolvedValue(payloadStub(records, create))
    const malformed = communication({ Id: 16160, Message: '<h1>Passage</h1>' })

    const result = await syncDailyBibleReadings({
      fetchCommunications: vi.fn().mockResolvedValue([communication(), malformed]),
      fetchPassage: vi.fn().mockResolvedValue(apiBiblePassage()),
      getPayload,
    })

    expect(result.created).toBe(1)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([
      'Rock communication 16160 failed validation: missing-opening-scripture',
    ])
    expect(create).toHaveBeenCalledOnce()
  })

  it('quarantines an API.Bible failure without blocking other valid readings', async () => {
    const records: ReadingRecord[] = []
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      records.push({
        id: records.length + 1,
        rockId: data.rockId as number,
        passageProvider: data.passageProvider as 'api-bible',
        scriptureFetchedAt: data.scriptureFetchedAt as string,
      })
    })
    const failed = communication({
      Id: 16161,
      Message: fixture.replaceAll('Hebrews 5:11-6:20', 'John 3:16'),
    })
    const result = await syncDailyBibleReadings({
      fetchCommunications: vi.fn().mockResolvedValue([communication(), failed]),
      fetchPassage: vi.fn(async (reference: string) => {
        if (reference === 'John 3:16') throw new Error('provider unavailable')
        return apiBiblePassage()
      }),
      getPayload: vi.fn().mockResolvedValue(payloadStub(records, create)),
    })

    expect(result).toMatchObject({
      created: 1,
      errors: ['API.Bible passage retrieval failed for Rock communications: 16161'],
    })
    expect(result.warnings).toEqual([
      'Rock communication 16161 could not load John 3:16 from API.Bible: Error: provider unavailable',
    ])
    expect(create).toHaveBeenCalledOnce()
  })

  it('does not delete or mutate history when Rock is empty or unavailable', async () => {
    const payload = payloadStub([{ id: 1, rockId: 16159, passageProvider: 'api-bible', scriptureFetchedAt: new Date().toISOString() }], vi.fn())

    await expect(syncDailyBibleReadings({
      fetchCommunications: vi.fn().mockResolvedValue([]),
      getPayload: vi.fn().mockResolvedValue(payload),
    })).resolves.toMatchObject({ created: 0, updated: 0, deleted: 0, errors: [] })
    await expect(syncDailyBibleReadings({
      fetchCommunications: vi.fn().mockRejectedValue(new Error('Rock unavailable')),
      getPayload: vi.fn().mockResolvedValue(payload),
    })).resolves.toMatchObject({ created: 0, updated: 0, deleted: 0, errors: ['Error: Rock unavailable'] })
  })

  it('replaces legacy email passage text with the API.Bible CSB cache', async () => {
    const records: ReadingRecord[] = [{ id: 7, rockId: 16159, passageProvider: null }]
    const payload = payloadStub(records, vi.fn())

    const result = await syncDailyBibleReadings({
      fetchCommunications: vi.fn().mockResolvedValue([communication()]),
      fetchPassage: vi.fn().mockResolvedValue(apiBiblePassage()),
      getPayload: vi.fn().mockResolvedValue(payload),
    })

    expect(result).toMatchObject({ created: 0, updated: 1, errors: [] })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'daily-bible-readings',
      id: 7,
      data: expect.objectContaining({
        passageText: 'CSB passage from API.Bible',
        passageProvider: 'api-bible',
        apiBibleFumsToken: 'fums-token',
      }),
    }))
  })

  it('refreshes API.Bible Scripture cached longer than thirteen days', async () => {
    const records: ReadingRecord[] = [{
      id: 7,
      rockId: 16159,
      passageProvider: 'api-bible',
      scriptureFetchedAt: '2000-01-01T00:00:00.000Z',
    }]
    const payload = payloadStub(records, vi.fn())
    const fetchPassage = vi.fn().mockResolvedValue(apiBiblePassage())

    const result = await syncDailyBibleReadings({
      fetchCommunications: vi.fn().mockResolvedValue([communication()]),
      fetchPassage,
      getPayload: vi.fn().mockResolvedValue(payload),
    })

    expect(result).toMatchObject({ created: 0, updated: 1, errors: [] })
    expect(fetchPassage).toHaveBeenCalledOnce()
  })

  it('prioritizes new readings and caps provider work inside the worker budget', async () => {
    const staleCommunications = Array.from(
      { length: MAX_API_BIBLE_READINGS_PER_RUN + 2 },
      (_, index) => communication({
        Id: 17_000 + index,
        SendDateTime: `2026-07-${String(index + 1).padStart(2, '0')}T05:00:54.003`,
      }),
    )
    const newReading = communication({
      Id: 18_000,
      SendDateTime: '2026-08-12T05:00:54.003',
      Message: fixture.replaceAll('Hebrews 5:11-6:20', 'John 3:16'),
    })
    const records: ReadingRecord[] = staleCommunications.map(({ Id }) => ({
      id: Id,
      rockId: Id,
      passageProvider: 'api-bible',
      scriptureFetchedAt: '2000-01-01T00:00:00.000Z',
    }))
    const fetchPassage = vi.fn().mockResolvedValue(apiBiblePassage())
    const payload = payloadStub(records, vi.fn())

    const result = await syncDailyBibleReadings({
      fetchCommunications: vi.fn().mockResolvedValue([...staleCommunications, newReading]),
      fetchPassage,
      getPayload: vi.fn().mockResolvedValue(payload),
    })

    expect(fetchPassage).toHaveBeenCalledTimes(MAX_API_BIBLE_READINGS_PER_RUN)
    expect(fetchPassage).toHaveBeenNthCalledWith(1, 'John 3:16')
    expect(result).toMatchObject({ created: 1, updated: MAX_API_BIBLE_READINGS_PER_RUN - 1 })
    expect(result.warnings).toContain(
      '3 Daily Bible Reading API.Bible refreshes were deferred to a later sync run',
    )
  })
})

type ReadingRecord = {
  id: number
  rockId: number
  passageProvider?: 'api-bible' | null
  scriptureFetchedAt?: string | null
}

function payloadStub(
  records: ReadingRecord[],
  create: ReturnType<typeof vi.fn>,
) {
  return {
    create,
    update: vi.fn(),
    find: vi.fn(async () => ({ docs: records })),
    db: {
      beginTransaction: vi.fn().mockResolvedValue('transaction'),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    },
  }
}

function apiBiblePassage() {
  return {
    id: 'HEB.5.11-HEB.6.20',
    reference: 'Hebrews 5:11-6:20',
    content: 'CSB passage from API.Bible',
    copyright: 'Christian Standard Bible copyright notice',
    fumsToken: 'fums-token',
  }
}

function communication(overrides: Partial<RockCommunication> = {}): RockCommunication {
  return {
    Id: 16159,
    Guid: '8bfe99e0-ab67-45d7-bf6d-e1dcfe3bf66b',
    Name: 'DBR 2026/08/10',
    ListGroupId: 28916,
    Subject: 'A Word from God for you today',
    Status: 3,
    SendDateTime: '2026-08-10T05:00:54.003',
    FutureSendDateTime: '2026-08-10T05:00:00',
    Message: fixture,
    ...overrides,
  }
}
