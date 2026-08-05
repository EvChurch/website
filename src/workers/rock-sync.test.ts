import { describe, expect, it, vi } from 'vitest'

import { runRockSyncWorker } from './rock-sync'

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

function syncResult(entity: string, errors: string[] = []) {
  return {
    entity,
    created: 0,
    updated: 1,
    deleted: 0,
    errors,
  }
}
