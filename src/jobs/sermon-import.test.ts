import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ sync: vi.fn(), lock: vi.fn(), notify: vi.fn() }))
vi.mock('@/sync/sermon-sync-runner', () => ({ runSermonSync: mocks.sync }))
vi.mock('@/lib/rock-sync-lock', () => ({ withRockSyncLock: mocks.lock }))
vi.mock('@/workers/rock-sync', () => ({ notifyWebsiteCache: mocks.notify }))
import configPromise from '../../payload.config'

async function runTask() {
  const config = await configPromise
  const task = config.jobs?.tasks?.find(task => task.slug === 'fullSermonSync')
  if (!task || typeof task.handler !== 'function') throw new Error('Missing import task')
  return task.handler({ req: { payload: { logger: { info: vi.fn() } } } } as unknown as Parameters<typeof task.handler>[0])
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.sync.mockResolvedValue([{ created: 1, updated: 0, errors: [] }])
  mocks.lock.mockImplementation(async work => ({ acquired: true, value: await work() }))
})
it('locks queued imports and notifies the website of changed content', async () => {
  await expect(runTask()).resolves.toMatchObject({ output: { created: 1, errors: 0 } })
  expect(mocks.lock).toHaveBeenCalledOnce()
  expect(mocks.notify).toHaveBeenCalledWith(await mocks.sync.mock.results[0].value)
})
it('retries overlapping imports without invoking the importer', async () => {
  mocks.lock.mockResolvedValue({ acquired: false })
  await expect(runTask()).rejects.toThrow('already in progress')
  expect(mocks.sync).not.toHaveBeenCalled()
})
it('invalidates successful changes but reports partial failure for retry', async () => {
  mocks.sync.mockResolvedValue([{ created: 1, updated: 0, errors: ['Download failed'] }])
  await expect(runTask()).rejects.toThrow('1 errors')
  expect(mocks.notify).toHaveBeenCalledOnce()
})
