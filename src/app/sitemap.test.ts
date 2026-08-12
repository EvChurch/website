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
              { slug: 'home', updatedAt: '2026-08-01T00:00:00.000Z' },
              { slug: 'next-steps', updatedAt: '2026-08-02T00:00:00.000Z' },
              { slug: 'about', updatedAt: '2026-08-03T00:00:00.000Z' },
            ]
          : [],
    }))
  })

  it('omits retired pages while retaining published home and child page URLs', async () => {
    const routes = await sitemap()
    const urls = routes.map(({ url }) => url)

    expect(urls).toContain('https://www.ev.church')
    expect(urls).toContain('https://www.ev.church/about')
    expect(urls).not.toContain('https://www.ev.church/next-steps')
  })
})
