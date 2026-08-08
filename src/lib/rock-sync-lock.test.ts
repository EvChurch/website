import { describe, expect, it, vi } from 'vitest'
import { withRockSyncLock } from './rock-sync-lock'


function makeMockClient(acquired: boolean): any {
  const mock: Record<string, unknown> = {
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockImplementation(async (text: string) => {
      if (text.includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired }] };
      }
      return { rows: [] };
    }),
    end: vi.fn().mockResolvedValue(undefined),
  }
  return mock
}

describe('withRockSyncLock', () => {
  it('runs the operation while holding the advisory lock', async () => {
    const client = makeMockClient(true)
    const operation = vi.fn().mockResolvedValue('done')

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
    const client = makeMockClient(false)
    const operation = vi.fn().mockResolvedValue('done')

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
    const client = makeMockClient(true)

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
