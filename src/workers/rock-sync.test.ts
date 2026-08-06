import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  runRockSyncWorker,
  runWorkerEntrypoint,
  waitForPayloadCleanup,
} from './rock-sync'

describe('runRockSyncWorker', () => {
  it('runs the reconciliation under the database lock', async () => {
    const results = [syncResult('events')]
    const runSync = vi.fn().mockResolvedValue(results)
    const withLock = vi.fn(async (operation: () => Promise<typeof results>) => ({
      acquired: true as const,
      value: await operation(),
    }))

    await expect(runRockSyncWorker({ runSync, withLock })).resolves.toEqual({
      status: 'completed',
      results,
    })
    expect(runSync).toHaveBeenCalledOnce()
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

    await expect(runRockSyncWorker({ runSync, withLock })).rejects.toThrow(
      'Sync completed with errors: events: Rock unavailable',
    )
  })

  it('skips cleanly when another reconciliation owns the lock', async () => {
    const runSync = vi.fn()
    const withLock = vi.fn().mockResolvedValue({ acquired: false })

    await expect(runRockSyncWorker({ runSync, withLock })).resolves.toEqual({
      status: 'skipped',
      reason: 'Rock sync is already in progress',
    })
    expect(runSync).not.toHaveBeenCalled()
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

    await runWorkerEntrypoint({ run, exit })

    expect(run).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('exits unsuccessfully when the worker fails', async () => {
    const error = new Error('sync failed')
    const run = vi.fn().mockRejectedValue(error)
    const exit = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runWorkerEntrypoint({ run, exit })

    expect(exit).toHaveBeenCalledWith(1)
    expect(consoleError).toHaveBeenCalledWith(error.message)
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
