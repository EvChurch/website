import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), fetchAllPages: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => mocks }))
vi.mock('@/lib/resources-api', () => ({ fetchAllPages: mocks.fetchAllPages }))
import { runSermonSync } from './sermon-sync-runner'

afterEach(() => vi.unstubAllGlobals())

const sermon = { id: 'new-sermon', name: 'The Transfiguration', publishedAt: '2026-10-11T07:48:00Z', audioUrl: 'https://example.test/audio.m4a', authors: [{ id: 'speaker', name: 'Preacher' }], series: [{ id: 'series', name: 'Luke' }], topics: [], scriptures: [{ id: 'scripture', name: 'Luke' }], sermonScriptures: [{ range: '9:28-36', scripture: { name: 'Luke' } }] }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchAllPages.mockImplementation(async (_query, key) => key === 'sermons' ? [sermon] : [])
  mocks.find.mockImplementation(async ({ collection, where }) => ({ docs: where ? [] : [{ id: 1, resourceId: ({ speakers: 'speaker', 'sermon-series': 'series', scriptures: 'scripture' } as Record<string, string>)[collection], slug: 'luke' }], hasNextPage: false }))
  mocks.create.mockResolvedValue({ id: 2 })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(32), { headers: { 'content-type': 'audio/mp4' } })))
})

it('imports new upstream sermons instead of reporting an empty successful sync', async () => {
  const results = await runSermonSync()
  expect(results.find(result => result.entity === 'sermons')).toMatchObject({ created: 1, errors: [] })
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'sermons', data: expect.objectContaining({ title: sermon.name, audio: 2, isPublished: true }), context: expect.objectContaining({ churchResourcesImport: true }) }))
})

it('preserves existing sermons and local series, even when missing from upstream', async () => {
  mocks.fetchAllPages.mockImplementation(async (_query, key) => key === 'sermons' ? [sermon] : [{ id: 'existing-taxonomy', name: 'Edited locally', category: { id: 'category' } }])
  mocks.find.mockImplementation(async () => ({ docs: [{ id: 1, resourceId: sermon.id, slug: 'edited', isPublished: true }], hasNextPage: false }))
  const results = await runSermonSync()
  expect(results.find(result => result.entity === 'sermons')).toMatchObject({ created: 0, updated: 0, deleted: 0, errors: [] })
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.create).not.toHaveBeenCalled()
})

it('reports unavailable audio instead of publishing an unplayable sermon', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))
  const results = await runSermonSync()
  expect(results.find(result => result.entity === 'sermons')?.errors).toHaveLength(1)
  expect(mocks.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'sermons' }))
})

it('removes unreferenced audio after a rejected sermon save so retries do not leak uploads', async () => {
  mocks.create.mockImplementation(async ({ collection }) => {
    if (collection === 'sermons') throw new Error('Rejected sermon')
    return { id: 2 }
  })
  const results = await runSermonSync()
  expect(results.find(result => result.entity === 'sermons')?.errors).toHaveLength(1)
  expect(mocks.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'sermon-audio', id: 2 }))
})

it('does not publish partial metadata when dependency import failed', async () => {
  mocks.find.mockResolvedValue({ docs: [], hasNextPage: false })
  const results = await runSermonSync()
  expect(results.find(result => result.entity === 'sermons')?.errors).toEqual([expect.stringContaining('taxonomy is incomplete')])
  expect(mocks.create).not.toHaveBeenCalled()
})
