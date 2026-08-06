import { describe, expect, it, vi } from 'vitest'
import { withRockSyncLock } from './rock-sync-lock'

function lockClient(acquired: boolean) {
  return {
    connect: vi.fn(async () => undefined),
    query: vi.fn(async (text: string) => ({
      rows: text.includes('pg_try_advisory_lock') ? [{ acquired }] : [],
    })),
    end: vi.fn(async () => undefined),
  }
}

describe('withRockSyncLock', () => {
  it('runs the operation while holding the advisory lock', async () => {
    const client = lockClient(true)
    const operation = vi.fn(async () => 'done')

    await expect(
      withRockSyncLock(operation, {
        connectionString: 'postgres://example',
        createClient: () => client,
      }),
    ).resolves.toEqual({ acquired: true, value: 'done' })

    expect(operation).toHaveBeenCalledOnce()
    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock($1)',
      expect.any(Array),
    )
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('does not run when another process holds the lock', async () => {
    const client = lockClient(false)
    const operation = vi.fn(async () => 'done')

    await expect(
      withRockSyncLock(operation, {
        connectionString: 'postgres://example',
        createClient: () => client,
      }),
    ).resolves.toEqual({ acquired: false })

    expect(operation).not.toHaveBeenCalled()
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('releases the lock when the operation fails', async () => {
    const client = lockClient(true)

    await expect(
      withRockSyncLock(
        async () => {
          throw new Error('sync failed')
        },
        {
          connectionString: 'postgres://example',
          createClient: () => client,
        },
      ),
    ).rejects.toThrow('sync failed')

    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock($1)',
      expect.any(Array),
    )
    expect(client.end).toHaveBeenCalledOnce()
  })
})
