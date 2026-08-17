import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findByID: vi.fn(),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({
  unstable_cache: mocks.unstableCache,
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({
    find: mocks.find,
    findByID: mocks.findByID,
  })),
}))

import { getLatestSermonWithSeries } from './latest-sermon'

describe('latest sermon data', () => {
  beforeEach(() => {
    mocks.find.mockReset()
    mocks.findByID.mockReset()
  })

  it('caches the sermon and populated series under both source tags', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['latest-sermon-with-series'],
      { tags: ['sermons', 'sermon-series'], revalidate: 3_600 },
    )
  })

  it('returns the latest published sermon with its populated series', async () => {
    const sermon = {
      id: 12,
      title: 'Hope',
      series: [{ id: 7, title: 'Living Hope', slug: 'living-hope' }],
    }
    const seriesDoc = { id: 7, title: 'Living Hope', bannerImage: { url: '/banner.jpg' } }
    mocks.find.mockResolvedValue({ docs: [sermon] })
    mocks.findByID.mockResolvedValue(seriesDoc)

    await expect(getLatestSermonWithSeries()).resolves.toEqual({ sermon, seriesDoc })
    expect(mocks.findByID).toHaveBeenCalledWith({
      collection: 'sermon-series',
      id: 7,
      depth: 1,
    })
  })
})
