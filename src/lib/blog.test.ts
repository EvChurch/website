import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: (callback: unknown) => callback,
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import { getBlogPostBySlug, getPublishedBlogPosts } from './blog'

describe('blog data', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists published posts newest first', async () => {
    mocks.find.mockResolvedValue({ docs: [{ id: 1, title: 'Real post' }] })

    await expect(getPublishedBlogPosts()).resolves.toEqual([{ id: 1, title: 'Real post' }])
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'blog-posts',
      sort: '-publishedDate',
      where: { _status: { equals: 'published' } },
      select: {
        title: true,
        slug: true,
        author: true,
        publishedDate: true,
        featuredImage: true,
        excerpt: true,
      },
    }))
  })

  it('looks up only a published post with the requested slug', async () => {
    mocks.find.mockResolvedValue({ docs: [{ id: 2, slug: 'real-post' }] })

    await expect(getBlogPostBySlug('real-post')).resolves.toEqual({ id: 2, slug: 'real-post' })
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'blog-posts',
      where: {
        and: [
          { slug: { equals: 'real-post' } },
          { _status: { equals: 'published' } },
        ],
      },
      select: expect.objectContaining({
        content: true,
        seo: true,
        isAiGenerated: true,
      }),
    }))
  })

  it('returns null when a slug has no published post', async () => {
    mocks.find.mockResolvedValue({ docs: [] })

    await expect(getBlogPostBySlug('missing')).resolves.toBeNull()
  })
})
