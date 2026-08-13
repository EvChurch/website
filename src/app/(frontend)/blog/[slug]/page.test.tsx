import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getBlogPostBySlug: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/lib/blog', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/blog')>(),
  getBlogPostBySlug: mocks.getBlogPostBySlug,
}))

import BlogPostPage, { generateMetadata } from './page'
import { renderToStaticMarkup } from 'react-dom/server'

describe('blog post page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not found when Payload has no published post for the slug', async () => {
    mocks.getBlogPostBySlug.mockResolvedValue(null)

    await expect(BlogPostPage({ params: Promise.resolve({ slug: 'missing' }) }))
      .rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })

  it('builds metadata from the Payload post instead of the URL slug', async () => {
    mocks.getBlogPostBySlug.mockResolvedValue({
      title: 'A real article title',
      slug: 'different-slug',
      excerpt: 'A real summary from Payload.',
      seo: {
        metaTitle: 'Custom search title',
        metaDescription: 'Custom search description.',
      },
      featuredImage: {
        url: 'https://cdn.example.com/blog.jpg',
        alt: 'People together',
        sizes: { largeWebp: { url: 'https://cdn.example.com/blog-1200.webp' } },
      },
    })

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'different-slug' }),
    })

    expect(metadata.title).toEqual({ absolute: 'Custom search title' })
    expect(metadata.description).toBe('Custom search description.')
    expect(metadata.openGraph).toEqual(expect.objectContaining({
      title: 'Custom search title',
      images: [{ url: 'https://cdn.example.com/blog-1200.webp', alt: 'People together' }],
    }))
  })

  it('renders the published CMS article fields and AI disclosure', async () => {
    mocks.getBlogPostBySlug.mockResolvedValue({
      id: 1,
      title: 'A real article title',
      slug: 'real-article',
      author: 'Jane Writer',
      publishedDate: '2026-03-12T00:00:00.000Z',
      excerpt: 'A real summary from Payload.',
      content: {
        root: {
          children: [{
            type: 'paragraph',
            children: [{ type: 'text', text: 'The real article body.' }],
          }],
        },
      },
      featuredImage: null,
      isAiGenerated: true,
      aiDisclosure: 'AI-assisted and reviewed.',
    })

    const markup = renderToStaticMarkup(
      await BlogPostPage({ params: Promise.resolve({ slug: 'real-article' }) }),
    )

    expect(markup).toContain('A real article title')
    expect(markup).toContain('Jane Writer')
    expect(markup).toContain('The real article body.')
    expect(markup).toContain('AI-assisted and reviewed.')
    expect(markup).not.toContain('Lorem ipsum')
  })
})
