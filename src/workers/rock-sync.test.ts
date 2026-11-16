import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cacheTagsForSyncResults,
  notifyCompletedWorker,
  notifyWebsiteCache,
  runRockSyncWorker,
  runWorkerEntrypoint,
  waitForPayloadCleanup,
} from './rock-sync'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('notifyCompletedWorker', () => {
  it('sends a success heartbeat only after a completed reconciliation', async () => {
    const notify = vi.fn().mockResolvedValue(true)

    await notifyCompletedWorker(
      { status: 'completed', results: [syncResult('events')] },
      notify,
    )
    await notifyCompletedWorker(
      { status: 'skipped', reason: 'Rock sync is already in progress' },
      notify,
    )

    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith(
      process.env.BETTER_STACK_ROCK_SYNC_HEARTBEAT_URL,
      'success',
    )
  })
})

describe('runRockSyncWorker', () => {
  it('notifies the website only after reconciliation completes under the database lock', async () => {
    const results = [syncResult('events')]
    const runSync = vi.fn().mockResolvedValue(results)
    const notifyWebsite = vi.fn().mockResolvedValue(undefined)
    const withLock = vi.fn(async (operation: () => Promise<typeof results>) => ({
      acquired: true as const,
      value: await operation(),
    }))

    await expect(runRockSyncWorker({ runSync, withLock, notifyWebsite })).resolves.toEqual({
      status: 'completed',
      results,
    })
    expect(runSync).toHaveBeenCalledOnce()
    expect(runSync.mock.invocationCallOrder[0]).toBeLessThan(
      notifyWebsite.mock.invocationCallOrder[0],
    )
    expect(notifyWebsite).toHaveBeenCalledWith(results)
  })

  it('fails the job when any entity reports an error', async () => {
    const runSync = vi.fn().mockResolvedValue([
      syncResult('campuses'),
      syncResult('events', ['Rock unavailable']),
    ])
    const withLock = async (operation: () => Promise<ReturnType<typeof syncResult>[]>) => ({
      acquired: true as const,
      value: await operation(),
    })

    const notifyWebsite = vi.fn()

    await expect(runRockSyncWorker({ runSync, withLock, notifyWebsite })).rejects.toThrow(
      'Sync completed with errors: events: Rock unavailable',
    )
    expect(notifyWebsite).toHaveBeenCalledOnce()
  })

  it('skips cleanly when another reconciliation owns the lock', async () => {
    const runSync = vi.fn()
    const withLock = vi.fn().mockResolvedValue({ acquired: false })

    const notifyWebsite = vi.fn()

    await expect(runRockSyncWorker({ runSync, withLock, notifyWebsite })).resolves.toEqual({
      status: 'skipped',
      reason: 'Rock sync is already in progress',
    })
    expect(runSync).not.toHaveBeenCalled()
    expect(notifyWebsite).not.toHaveBeenCalled()
  })

  it('retains sync errors and logs results before a cache refresh failure', async () => {
    const results = [syncResult('events', ['Rock unavailable'])]
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const notifyWebsite = vi.fn().mockRejectedValue(new Error('cache unavailable'))
    const runSync = vi.fn().mockResolvedValue(results)
    const withLock = vi.fn(async (operation: () => Promise<typeof results>) => ({
      acquired: true as const, value: await operation(),
    }))

    await expect(runRockSyncWorker({ runSync, withLock, notifyWebsite })).rejects.toThrow(
      'Sync completed with errors: events: Rock unavailable; cache unavailable',
    )
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ message: 'Rock sync data phase finished', results })
    expect(log.mock.invocationCallOrder[0]).toBeLessThan(notifyWebsite.mock.invocationCallOrder[0])
    expect(runSync).toHaveBeenCalledOnce()
  })

  it('reports cache exhaustion as a worker failure without rerunning synchronization', async () => {
    const results = [syncResult('events')]
    const runSync = vi.fn().mockResolvedValue(results)
    const notifyWebsite = vi.fn().mockRejectedValue(new Error('cache retries exhausted'))
    const withLock = async (operation: () => Promise<typeof results>) => ({
      acquired: true as const, value: await operation(),
    })
    const exit = vi.fn()
    const notify = vi.fn().mockResolvedValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await runWorkerEntrypoint({ run: () => runRockSyncWorker({ runSync, withLock, notifyWebsite }).then(() => {}), exit, notify })

    expect(runSync).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledWith(1)
    expect(notify).toHaveBeenCalledExactlyOnceWith(process.env.BETTER_STACK_ROCK_SYNC_HEARTBEAT_URL, 'failure')
  })
})

describe('cacheTagsForSyncResults', () => {
  it('maps only changed sync entities to whitelisted cache tags', () => {
    expect(cacheTagsForSyncResults([
      syncResult('campuses'),
      syncResult('daily-bible-readings'),
      syncResult('service-guide-items'),
      { ...syncResult('sermons'), updated: 0 },
      syncResult('connect-group-leader-resources'),
    ])).toEqual(['campuses', 'daily-bible-readings', 'service-guide'])
  })
})

describe('notifyWebsiteCache', () => {
  beforeEach(() => {
    vi.stubEnv('APP_BASE_URL', 'https://www.ev.church')
    vi.stubEnv('CRON_SECRET', 'cache-secret')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('posts changed tags to the authenticated internal endpoint', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://www.ev.church')
    vi.stubEnv('CRON_SECRET', 'cache-secret')
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await notifyWebsiteCache([
      syncResult('events'),
      syncResult('daily-bible-readings'),
    ], fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      new URL('https://www.ev.church/api/internal/cache/revalidate'),
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer cache-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tags: ['events', 'daily-bible-readings'] }),
        signal: expect.any(AbortSignal),
      },
    )
  })

  it('does not make a request when reconciliation changed no public data', async () => {
    const fetcher = vi.fn()

    await notifyWebsiteCache([{ ...syncResult('events'), updated: 0 }], fetcher)

    expect(fetcher).not.toHaveBeenCalled()
  })

  it('recovers from a network failure and server error using bounded backoff', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const wait = vi.fn().mockResolvedValue(undefined)

    await notifyWebsiteCache([syncResult('events')], fetcher, { wait })

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(wait.mock.calls).toEqual([[1000], [2000]])
    expect(new Set(fetcher.mock.calls.map(call => call[1].signal)).size).toBe(3)
    expect(fetcher.mock.calls.every(call => call[1].body === JSON.stringify({ tags: ['events'] }))).toBe(true)
  })

  it.each([408, 429, 500, 502, 503, 504])('retries transient HTTP %i', async (status) => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const wait = vi.fn().mockResolvedValue(undefined)

    await notifyWebsiteCache([syncResult('events')], fetcher, { wait })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledExactlyOnceWith(1000)
  })

  it.each([400, 401, 403, 404])('fails immediately for permanent HTTP %i', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }))
    const wait = vi.fn()

    await expect(notifyWebsiteCache([syncResult('events')], fetcher, { wait }))
      .rejects.toThrow(`failed after 1 attempt: HTTP ${status}`)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })

  it('stops after three failures and reports a safe connection error code', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('secret URL', {
      cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
    }))
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(notifyWebsiteCache([syncResult('events')], fetcher, { wait }))
      .rejects.toThrow('Website cache revalidation failed after 3 attempts: network error (UND_ERR_CONNECT_TIMEOUT)')

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(wait.mock.calls).toEqual([[1000], [2000]])
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('secret URL')
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('cache-secret')
  })

  it('aborts each stalled request after ten seconds and ultimately fails', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_url: Parameters<typeof fetch>[0], init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
    }))
    const wait = vi.fn().mockResolvedValue(undefined)
    const assertion = expect(notifyWebsiteCache([syncResult('events')], fetcher, { wait }))
      .rejects.toThrow('failed after 3 attempts: request timed out')

    await vi.advanceTimersByTimeAsync(30_000)
    await assertion

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls.every(call => call[1]!.signal!.aborted)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not retry missing configuration', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const fetcher = vi.fn()

    await expect(notifyWebsiteCache([syncResult('events')], fetcher))
      .rejects.toThrow('APP_BASE_URL and CRON_SECRET are required')

    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('waitForPayloadCleanup', () => {
  afterEach(() => vi.useRealTimers())

  it('stops waiting when Payload cleanup does not settle', async () => {
    vi.useFakeTimers()
    const destroy = vi.fn(() => new Promise<void>(() => {}))

    const cleanup = waitForPayloadCleanup({ destroy, timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(100)

    await expect(cleanup).resolves.toBe(false)
    expect(destroy).toHaveBeenCalledOnce()
  })
})

describe('runWorkerEntrypoint', () => {
  it('exits successfully when the worker completes', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()
    const notify = vi.fn()

    await runWorkerEntrypoint({ run, exit, notify })

    expect(run).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledWith(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it('exits unsuccessfully when the worker fails', async () => {
    const error = new Error('sync failed')
    const run = vi.fn().mockRejectedValue(error)
    const exit = vi.fn()
    const notify = vi.fn().mockResolvedValue(true)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runWorkerEntrypoint({ run, exit, notify })

    expect(exit).toHaveBeenCalledWith(1)
    expect(consoleError).toHaveBeenCalledWith(error.message)
    expect(notify).toHaveBeenCalledWith(
      process.env.BETTER_STACK_ROCK_SYNC_HEARTBEAT_URL,
      'failure',
    )
    consoleError.mockRestore()
  })
})

function syncResult(entity: string, errors: string[] = []) {
  return {
    entity,
    created: 0,
    updated: 1,
    deleted: 0,
    errors,
  }
}
