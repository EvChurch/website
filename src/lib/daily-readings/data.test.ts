import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({
  unstable_cache: mocks.unstableCache,
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import {
  getDailyReadingByRockId,
  getPublishedDailyReadings,
} from './data'

describe('daily reading data cache', () => {
  beforeEach(() => mocks.find.mockReset())

  it('tags list and detail caches for sync invalidation', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['published-daily-readings'],
      { tags: ['daily-bible-readings'], revalidate: 3_600 },
    )
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['daily-reading-by-rock-id'],
      { tags: ['daily-bible-readings'], revalidate: 3_600 },
    )
  })

  it('preserves the list limit and detail identifier as cache arguments', async () => {
    mocks.find.mockResolvedValue({ docs: [] })

    await getPublishedDailyReadings(12)
    await getDailyReadingByRockId(42)

    expect(mocks.find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collection: 'daily-bible-readings', limit: 12 }),
    )
    expect(mocks.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          and: [
            { rockId: { equals: 42 } },
            { isPublished: { equals: true } },
          ],
        },
      }),
    )
  })
})
