import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/public-not-found', () => ({ publicNotFound: mocks.notFound }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import DynamicPage, { generateMetadata } from './page'

describe('retired dynamic pages', () => {
  beforeEach(() => vi.clearAllMocks())

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
})
