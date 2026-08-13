import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  record: vi.fn(),
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/lib/missing-paths', () => ({ recordMissingPublicPath: mocks.record }))

import { publicNotFound } from './public-not-found'

describe('publicNotFound', () => {
  beforeEach(() => vi.clearAllMocks())

  it('schedules tracking only when explicitly terminating a public route as not found', async () => {
    let scheduled: (() => Promise<void>) | undefined
    mocks.after.mockImplementation((callback: () => Promise<void>) => {
      scheduled = callback
    })

    expect(() => publicNotFound('old')).toThrow('NEXT_NOT_FOUND')

    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.notFound).toHaveBeenCalledOnce()
    expect(mocks.record).not.toHaveBeenCalled()

    await scheduled?.()
    expect(mocks.record).toHaveBeenCalledWith('/old')
  })

  it('preserves encoded structural characters so ineligible paths are rejected', async () => {
    mocks.after.mockImplementation((callback: () => unknown) => callback())

    expect(() => publicNotFound('old/nested', 'query?', 'fragment#'))
      .toThrow('NEXT_NOT_FOUND')

    expect(mocks.record).toHaveBeenCalledWith('/old%2Fnested/query%3F/fragment%23')
  })

  it('contains unexpected tracking failures after the 404 decision', async () => {
    let scheduled: (() => Promise<void>) | undefined
    mocks.after.mockImplementation((callback: () => Promise<void>) => {
      scheduled = callback
    })
    mocks.record.mockRejectedValue(new Error('database unavailable'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => publicNotFound('old')).toThrow('NEXT_NOT_FOUND')
    await expect(scheduled?.()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledWith({
      category: 'missing-path-write-failed',
      path: '/old',
    })

    error.mockRestore()
  })
})
