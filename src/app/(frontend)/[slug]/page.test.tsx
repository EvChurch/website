import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
})
