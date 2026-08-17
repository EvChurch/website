import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cacheTagsForSyncResults,
  notifyCompletedWorker,
  notifyWebsiteCache,
  runRockSyncWorker,
  runWorkerEntrypoint,
  waitForPayloadCleanup,
} from './rock-sync'

afterEach(() => vi.unstubAllEnvs())

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
    expect(notifyWebsite).not.toHaveBeenCalled()
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
      },
    )
  })

  it('does not make a request when reconciliation changed no public data', async () => {
    const fetcher = vi.fn()

    await notifyWebsiteCache([{ ...syncResult('events'), updated: 0 }], fetcher)

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
