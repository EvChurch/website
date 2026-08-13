import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  trackedNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/lib/tracked-not-found', () => ({ trackedNotFound: mocks.trackedNotFound }))

import MissingPublicPage from './page'

describe('frontend missing path catch-all', () => {
  it('routes unmatched multi-segment paths to the shared not-found boundary', async () => {
    await expect(MissingPublicPage({
      params: Promise.resolve({ missing: ['old', 'nested-page'] }),
    })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.trackedNotFound).toHaveBeenCalledWith('old', 'nested-page')
  })
})
