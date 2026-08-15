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

import {
  getScripturePageData,
  getSeriesPageData,
  getSermonPageData,
  getSpeakerPageData,
  getTopicPageData,
} from './sermon-pages'

describe('public sermon page data', () => {
  beforeEach(() => {
    mocks.find.mockReset()
    mocks.findByID.mockReset()
  })

  it('uses bounded tagged caches for sermon and taxonomy slug pages', () => {
    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      ['public-sermon-page-by-slug'],
      {
        tags: ['sermons', 'sermon-series', 'speakers', 'topics', 'scriptures'],
        revalidate: 86_400,
      },
    )
    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      ['public-sermon-series-page-by-slug'],
      { tags: ['sermons', 'sermon-series'], revalidate: 86_400 },
    )
    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      3,
      expect.any(Function),
      ['public-sermon-speaker-page-by-slug'],
      { tags: ['sermons', 'speakers'], revalidate: 86_400 },
    )
    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      4,
      expect.any(Function),
      ['public-sermon-topic-page-by-slug'],
      { tags: ['sermons', 'topics', 'categories'], revalidate: 86_400 },
    )
    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      5,
      expect.any(Function),
      ['public-sermon-scripture-page-by-slug'],
      { tags: ['sermons', 'scriptures'], revalidate: 86_400 },
    )
  })

  it('preserves sermon media relationships, navigation, and related sermons', async () => {
    const sermon = {
      id: 42,
      slug: 'hope',
      publishedAt: '2026-08-10T00:00:00.000Z',
      series: [{ id: 7, title: 'Living Hope', slug: 'living-hope' }],
    }
    const seriesDoc = { id: 7, bannerImage: { url: '/banner.jpg' } }
    mocks.find
      .mockResolvedValueOnce({ docs: [sermon] })
      .mockResolvedValueOnce({ docs: [{ title: 'Previous', slug: 'previous' }] })
      .mockResolvedValueOnce({ docs: [{ title: 'Next', slug: 'next' }] })
      .mockResolvedValueOnce({ docs: [{ id: 41, slug: 'related' }] })
    mocks.findByID.mockResolvedValue(seriesDoc)

    await expect(getSermonPageData('hope')).resolves.toEqual({
      sermon,
      seriesDoc,
      prevSermon: { title: 'Previous', slug: 'previous' },
      nextSermon: { title: 'Next', slug: 'next' },
      moreBySeries: [{ id: 41, slug: 'related' }],
    })

    expect(mocks.find).toHaveBeenNthCalledWith(1, expect.objectContaining({
      collection: 'sermons',
      depth: 1,
      limit: 1,
      where: {
        and: [
          { slug: { equals: 'hope' } },
          { isPublished: { equals: true } },
        ],
      },
    }))
    expect(mocks.findByID).toHaveBeenCalledWith({
      collection: 'sermon-series',
      id: 7,
      depth: 1,
    })
    expect(mocks.find).toHaveBeenNthCalledWith(4, expect.objectContaining({
      collection: 'sermons',
      limit: 3,
      depth: 1,
      where: {
        and: [
          { isPublished: { equals: true } },
          { series: { contains: 7 } },
          { id: { not_equals: 42 } },
        ],
      },
    }))
  })

  it('does not run dependent sermon reads when a taxonomy slug is missing', async () => {
    mocks.find.mockResolvedValue({ docs: [] })

    await expect(getSeriesPageData('missing')).resolves.toEqual({ series: null, sermonsResult: null })
    await expect(getSpeakerPageData('missing')).resolves.toEqual({ speaker: null, sermonsResult: null })
    await expect(getTopicPageData('missing')).resolves.toEqual({ topic: null, sermonsResult: null })
    await expect(getScripturePageData('missing')).resolves.toEqual({ scripture: null, sermonsResult: null })

    expect(mocks.find).toHaveBeenCalledTimes(4)
  })
})
