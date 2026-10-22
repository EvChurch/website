import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadGivingSubmissionVersion } from './submission-session'

describe('giving submission session', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads the current runtime version without caching or refreshing it automatically', async () => {
    const fetcher = vi.fn(async () => Response.json({ version: 'V'.repeat(43) }))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    expect(await loadGivingSubmissionVersion(signal)).toBe('V'.repeat(43))
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/giving/session', { cache: 'no-store', signal })
  })

  it.each([Response.json({ version: 'short' }), Response.json({ version: 'V'.repeat(43) }, { status: 503 })])('rejects unavailable or malformed sessions', async (response) => {
    vi.stubGlobal('fetch', vi.fn(async () => response))
    await expect(loadGivingSubmissionVersion(new AbortController().signal)).rejects.toThrow('Giving session unavailable')
  })
})
