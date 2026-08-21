import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({ unstable_cache: mocks.unstableCache }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import sitemap from './sitemap'

describe('sitemap', () => {
  beforeEach(() => {
    mocks.find.mockReset()
    mocks.find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs:
        collection === 'pages'
          ? [
              { title: 'Home', slug: 'home', updatedAt: '2026-08-01T00:00:00.000Z' },
              { title: 'Next Steps', slug: 'next-steps', updatedAt: '2026-08-02T00:00:00.000Z' },
              { title: 'About', slug: 'about', updatedAt: '2026-08-03T00:00:00.000Z' },
              { title: 'Give', slug: 'give', updatedAt: '2026-08-04T00:00:00.000Z' },
              { title: 'Privacy Policy', slug: 'privacy', updatedAt: '2026-08-05T00:00:00.000Z' },
              { title: 'Terms of Service', slug: 'terms', updatedAt: '2026-08-06T00:00:00.000Z' },
            ]
          : [],
    }))
  })

  it('omits retired pages while retaining published home and child page URLs', async () => {
    const routes = await sitemap()
    const urls = routes.map(({ url }) => url)

    expect(urls).toContain('https://www.ev.church')
    expect(urls).toContain('https://www.ev.church/about')
    expect(urls).toContain('https://www.ev.church/sitemap')
    expect(urls).toContain('https://www.ev.church/privacy')
    expect(urls).toContain('https://www.ev.church/terms')
    expect(urls).not.toContain('https://www.ev.church/next-steps')
    expect(urls).toContain('https://www.ev.church/give')
  })

  it('uses all source tags and a short fallback for mixed sitemap content', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['public-sitemap-sections'],
      {
        tags: [
          'pages',
          'campuses',
          'events',
          'blog-posts',
          'sermons',
          'sermon-series',
          'speakers',
          'topics',
          'scriptures',
        ],
        revalidate: 300,
      },
    )

    const source = readFileSync(join(process.cwd(), 'src/app/sitemap.ts'), 'utf8')
    expect(source).toContain('export const revalidate = 300')
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
  })
})
