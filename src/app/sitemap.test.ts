import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import sitemap from './sitemap'

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs:
        collection === 'pages'
          ? [
              { title: 'Home', slug: 'home', updatedAt: '2026-08-01T00:00:00.000Z' },
              { title: 'Next Steps', slug: 'next-steps', updatedAt: '2026-08-02T00:00:00.000Z' },
              { title: 'About', slug: 'about', updatedAt: '2026-08-03T00:00:00.000Z' },
              { title: 'Give', slug: 'give', updatedAt: '2026-08-04T00:00:00.000Z' },
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
    expect(urls).not.toContain('https://www.ev.church/next-steps')
    expect(urls).not.toContain('https://www.ev.church/give')
  })
})
