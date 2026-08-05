import { describe, expect, it, vi } from 'vitest'

import { triggerRockSync } from './rock-sync'

describe('triggerRockSync', () => {
  it('authenticates with a bearer token and returns the sync summary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          duration: '1200ms',
          results: [
            {
              entity: 'events',
              created: 5,
              updated: 0,
              deleted: 0,
              hasErrors: false,
            },
          ],
          errors: [],
        }),
        { status: 200 },
      ),
    )

    const result = await triggerRockSync({
      env: {
        CRON_SECRET: 'cron-secret',
        SYNC_URL: 'https://new.ev.church/api/sync/trigger',
      },
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://new.ev.church/api/sync/trigger',
      expect.objectContaining({
        headers: { Authorization: 'Bearer cron-secret' },
      }),
    )
    expect(result.results[0]).toMatchObject({ entity: 'events', created: 5 })
  })

  it('fails without a cron secret', async () => {
    await expect(
      triggerRockSync({ env: {}, fetchImpl: vi.fn() }),
    ).rejects.toThrow('CRON_SECRET is required')
  })

  it('fails without an explicit sync URL', async () => {
    const fetchImpl = vi.fn()

    await expect(
      triggerRockSync({ env: { CRON_SECRET: 'cron-secret' }, fetchImpl }),
    ).rejects.toThrow('SYNC_URL is required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails when the sync reports entity errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          duration: '200ms',
          results: [
            {
              entity: 'events',
              created: 0,
              updated: 0,
              deleted: 0,
              hasErrors: true,
            },
          ],
          errors: ['Rock API unavailable'],
        }),
        { status: 200 },
      ),
    )

    await expect(
      triggerRockSync({
        env: {
          CRON_SECRET: 'cron-secret',
          SYNC_URL: 'https://example.test/api/sync/trigger',
        },
        fetchImpl,
      }),
    ).rejects.toThrow('Rock API unavailable')
  })

  it('fails when an entity is marked failed without aggregate errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          duration: '200ms',
          results: [
            {
              entity: 'events',
              created: 0,
              updated: 0,
              deleted: 0,
              hasErrors: true,
            },
          ],
          errors: [],
        }),
        { status: 200 },
      ),
    )

    await expect(
      triggerRockSync({
        env: {
          CRON_SECRET: 'cron-secret',
          SYNC_URL: 'https://example.test/api/sync/trigger',
        },
        fetchImpl,
      }),
    ).rejects.toThrow('Sync reported failed entities: events')
  })

  it('fails when a successful response is invalid JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 }))

    await expect(
      triggerRockSync({
        env: {
          CRON_SECRET: 'cron-secret',
          SYNC_URL: 'https://example.test/api/sync/trigger',
        },
        fetchImpl,
      }),
    ).rejects.toThrow('Sync request returned invalid JSON')
  })

  it('fails when the endpoint reports failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, duration: '10ms', results: [], errors: [] }),
        { status: 200 },
      ),
    )

    await expect(
      triggerRockSync({
        env: {
          CRON_SECRET: 'cron-secret',
          SYNC_URL: 'https://example.test/api/sync/trigger',
        },
        fetchImpl,
      }),
    ).rejects.toThrow('Sync endpoint reported failure')
  })

  it('fails on a non-successful HTTP response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    )

    await expect(
      triggerRockSync({
        env: {
          CRON_SECRET: 'cron-secret',
          SYNC_URL: 'https://example.test/api/sync/trigger',
        },
        fetchImpl,
      }),
    ).rejects.toThrow('HTTP 401')
  })
})
