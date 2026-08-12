import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPublishedBlogPosts: vi.fn(),
}))

vi.mock('@/lib/blog', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/blog')>(),
  getPublishedBlogPosts: mocks.getPublishedBlogPosts,
}))

import BlogPage from './page'

describe('blog listing page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders published Payload post fields', async () => {
    mocks.getPublishedBlogPosts.mockResolvedValue([{
      id: 1,
      title: 'A real CMS story',
      slug: 'real-cms-story',
      author: 'Ev Church Editorial',
      publishedDate: '2026-03-12T00:00:00.000Z',
      excerpt: 'This summary came from Payload.',
      featuredImage: null,
    }])

    const markup = renderToStaticMarkup(await BlogPage())

    expect(markup).toContain('A real CMS story')
    expect(markup).toContain('href="/blog/real-cms-story"')
    expect(markup).toContain('This summary came from Payload.')
    expect(markup).toContain('Ev Church Editorial')
    expect(markup).not.toContain('Finding Community in a Busy City')
  })

  it('renders a calm empty state when there are no published posts', async () => {
    mocks.getPublishedBlogPosts.mockResolvedValue([])

    const markup = renderToStaticMarkup(await BlogPage())

    expect(markup).toContain('There are no published posts yet')
  })
})
