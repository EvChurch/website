import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ lock: vi.fn(), sync: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/rock-sync-lock', () => ({ withRockSyncLock: mocks.lock }))
vi.mock('@/sync/sermon-sync-runner', () => ({ runSermonSync: mocks.sync }))
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidate }))
vi.mock('@/workers/rock-sync', () => ({ cacheTagsForSyncResults: () => ['sermons'] }))
import { GET } from './route'
afterEach(() => vi.unstubAllEnvs())
const request = () => new NextRequest('https://example.test/api/sync/sermons?secret=test-secret')
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
  mocks.sync.mockResolvedValue([{ entity: 'sermons', created: 2, errors: [] }])
  mocks.lock.mockImplementation(async work => ({ acquired: true, value: await work() }))
})
it('imports sermons and invalidates the website cache instead of returning 410', async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true, created: 2 })
  expect(mocks.sync).toHaveBeenCalledOnce()
  expect(mocks.revalidate).toHaveBeenCalledWith('sermons', { expire: 0 })
})
it('rejects unauthenticated requests without starting the import', async () => {
  expect((await GET(new NextRequest('https://example.test/api/sync/sermons'))).status).toBe(401)
  expect(mocks.lock).not.toHaveBeenCalled()
})
it('does not start another import while the worker holds the lock', async () => {
  mocks.lock.mockResolvedValue({ acquired: false })
  expect((await GET(request())).status).toBe(409)
  expect(mocks.sync).not.toHaveBeenCalled()
})
it('reports partial failure and still invalidates successfully imported sermons', async () => {
  mocks.sync.mockResolvedValue([{ entity: 'sermons', created: 1, errors: ['Audio unavailable'] }])
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toMatchObject({ ok: false, created: 1, errors: 1 })
  expect(mocks.revalidate).toHaveBeenCalledOnce()
})
