import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))

import MissingPublicPage from './page'

describe('frontend missing path catch-all', () => {
  it('routes unmatched multi-segment paths to the shared not-found boundary', async () => {
    expect(() => MissingPublicPage()).toThrow('NEXT_NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })
})
