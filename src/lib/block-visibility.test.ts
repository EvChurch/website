import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cache: vi.fn((callback: (...args: never[]) => unknown) => callback) }))
vi.mock('next/cache', () => ({ unstable_cache: mocks.cache }))
import { getVisibilityCacheWindow, getVisibleBlocks, isBlockVisible } from './block-visibility'

const start = '2026-12-01T11:00:00.000Z'
const end = '2026-12-27T11:00:00.000Z' // Midnight 28 December in Auckland (NZDT).

describe('block visibility', () => {
  beforeEach(() => { mocks.cache.mockClear(); vi.useRealTimers() })

  it('includes the start and excludes the end, with either date optional', () => {
    expect(isBlockVisible({}, Date.parse(end))).toBe(true)
    expect(isBlockVisible({ visibility: { from: start } }, Date.parse(start) - 1)).toBe(false)
    expect(isBlockVisible({ visibility: { from: start } }, Date.parse(start))).toBe(true)
    expect(isBlockVisible({ visibility: { until: end } }, Date.parse(end) - 1)).toBe(true)
    expect(isBlockVisible({ visibility: { until: end } }, Date.parse(end))).toBe(false)
  })

  it('expires at the normal lifetime or the nearest future boundary', () => {
    const blocks = [{ visibility: { from: start, until: end } }]
    expect(getVisibilityCacheWindow(blocks, 300, Date.parse(start) - 600_000).revalidate).toBe(300)
    expect(getVisibilityCacheWindow(blocks, 300, Date.parse(start) - 30_000).revalidate).toBe(30)
    expect(getVisibilityCacheWindow(blocks, 300, Date.parse(end) - 60_000).revalidate).toBe(60)
    expect(getVisibilityCacheWindow(blocks, 300, Date.parse(end)).revalidate).toBe(300)
    expect(getVisibilityCacheWindow([], 300).revalidate).toBe(300)
  })

  it('uses the earliest boundary across blocks and never disables caching', () => {
    expect(getVisibilityCacheWindow([
      { visibility: { from: start } }, { visibility: { until: '2026-12-01T10:59:30Z' } },
    ], 300, Date.parse(start) - 60_000).revalidate).toBe(30)
    expect(getVisibilityCacheWindow([{visibility:{until:end}}], 300, Date.parse(end)-100).revalidate).toBe(1)
  })

  it('uses a new cache period after the deadline and preserves ordinary layouts', async () => {
    vi.useFakeTimers()
    const ordinary = [{ visibility: null, id: 'ordinary' }]
    expect(await getVisibleBlocks(ordinary)).toBe(ordinary)
    expect(mocks.cache).not.toHaveBeenCalled()
    const blocks = [...ordinary, { id: 'christmas', visibility: { until: end } }]
    vi.setSystemTime(Date.parse(end) - 60_000)
    expect(await getVisibleBlocks(blocks)).toHaveLength(2)
    expect(mocks.cache).toHaveBeenLastCalledWith(expect.any(Function), ['scheduled-page-blocks'], {
      revalidate: 60, tags: ['pages', 'campuses'],
    })
    vi.setSystemTime(Date.parse(end))
    expect(await getVisibleBlocks(blocks)).toEqual(ordinary)
    expect(getVisibilityCacheWindow(blocks, 300).periodStart).toBe(Date.parse(end))
    vi.useRealTimers()
  })
})
