import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  renderBlocks: vi.fn(() => null),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({
  unstable_cache: mocks.unstableCache,
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

vi.mock('@/components/blocks/RenderBlocks', () => ({
  RenderBlocks: mocks.renderBlocks,
}))

import HomePage from './page'

describe('HomePage upcoming events placement', () => {
  beforeEach(() => {
    mocks.find.mockReset()
    mocks.renderBlocks.mockClear()
  })

  it('uses the tagged persistent page cache without forcing dynamic rendering', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['home-page'],
      { tags: ['pages'], revalidate: 86_400 },
    )

    const source = readFileSync(
      join(process.cwd(), 'src/app/(frontend)/page.tsx'),
      'utf8',
    )
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
    expect(source).toContain('cache(getCachedHomePage)')
  })

  it('renders the Payload layout without injecting events outside it', async () => {
    const blocks = [
      { id: 'hero', blockType: 'hero' },
      { id: 'sermon', blockType: 'latestSermon' },
      { id: 'events', blockType: 'upcomingEvents' },
      { id: 'cta', blockType: 'cta' },
    ]
    mocks.find.mockResolvedValue({ docs: [{ layout: blocks }] })

    renderToStaticMarkup(await HomePage())

    expect(mocks.renderBlocks).toHaveBeenCalledOnce()
    expect(mocks.renderBlocks).toHaveBeenCalledWith({ blocks }, undefined)
  })
})
