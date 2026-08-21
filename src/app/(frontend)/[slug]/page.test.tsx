import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({ unstable_cache: mocks.unstableCache }))

vi.mock('@/lib/tracked-not-found', () => ({ trackedNotFound: mocks.notFound }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import DynamicPage, { generateMetadata } from './page'

describe('retired dynamic pages', () => {
  beforeEach(() => {
    mocks.find.mockClear()
    mocks.notFound.mockClear()
  })

  it('returns not found for the retired Next Steps slug without querying Payload', async () => {
    await expect(
      DynamicPage({ params: Promise.resolve({ slug: 'next-steps' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mocks.notFound).toHaveBeenCalledWith('next-steps')
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('returns empty metadata for the retired Next Steps slug without querying Payload', async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: 'next-steps' }) }),
    ).resolves.toEqual({})

    expect(mocks.notFound).not.toHaveBeenCalled()
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('uses the tagged page source cache and a long ISR fallback', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['public-page-by-slug'],
      { tags: ['pages'], revalidate: 86_400 },
    )

    const source = readFileSync(
      join(process.cwd(), 'src/app/(frontend)/[slug]/page.tsx'),
      'utf8',
    )
    expect(source).toContain('export const revalidate = 86400')
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
  })

  it('renders simple-content pages from Payload in the narrow content layout', async () => {
    mocks.find.mockResolvedValueOnce({
      docs: [
        {
          title: 'Privacy Policy',
          slug: 'privacy-test',
          template: 'simple-content',
          updatedAt: '2026-08-22T00:00:00.000Z',
          layout: [
            {
              id: 'section-1',
              blockType: 'content',
              heading: '1. Who we are',
              body: {
                root: {
                  children: [
                    {
                      type: 'paragraph',
                      children: [{ type: 'text', text: 'Privacy content from Payload.' }],
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    })

    const page = await DynamicPage({
      params: Promise.resolve({ slug: 'privacy-test' }),
    })
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('>Privacy Policy<')
    expect(markup).toContain('>1. Who we are<')
    expect(markup).toContain('Privacy content from Payload.')
    expect(markup).toContain('Last updated: August 2026')
  })
})
