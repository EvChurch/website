import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { S3 } from '@aws-sdk/client-s3'
import { parse } from 'dotenv'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const fixtures = vi.hoisted(() => ({ sermons: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/resources-api', () => ({
  fetchAllPages: async (_query: string, key: string) => key === 'sermons' ? fixtures.sermons : [],
}))

const enabled = process.env.RUN_SERMON_IMPORT_STORAGE_INTEGRATION === 'true'
let payload: Payload
const objects = new Map<string, Buffer>()
const sermonIds: number[] = []
const audioIds: number[] = []
const bodies = [Buffer.alloc(32, 1), Buffer.alloc(32, 2)]

beforeAll(async () => {
  if (!enabled) return
  const env = parse(await readFile('.env.local'))
  const database = new URL(env.DATABASE_URL)
  if (!database.pathname.startsWith('/evchurch_dev_wt_') || !['', 'localhost', '127.0.0.1'].includes(database.hostname)) throw new Error('Use an isolated local worktree database.')
  Object.assign(process.env, env, {
    S3_BUCKET: 'synthetic-sermon-import', S3_ENDPOINT: 'http://127.0.0.1:57153',
    S3_ACCESS_KEY_ID: 'synthetic', S3_SECRET_ACCESS_KEY: 'synthetic', S3_REGION: 'auto',
    RESEND_API_KEY: '', KRISP_API_KEY: '',
  })
  vi.spyOn(S3.prototype, 'putObject').mockImplementation(async input => {
    if (!Buffer.isBuffer(input.Body) || !input.Key) throw new Error('Expected synthetic upload bytes')
    objects.set(input.Key, Buffer.from(input.Body))
    return { $metadata: {} }
  })
  vi.spyOn(S3.prototype, 'deleteObject').mockImplementation(async input => {
    objects.delete(input.Key!)
    return { $metadata: {} }
  })
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    const index = url.endsWith('/second') ? 1 : 0
    return new Response(bodies[index], { headers: { 'content-type': 'audio/mp4' } })
  }))
  const { default: configPromise } = await import('../../payload.config')
  const config = await configPromise
  config.jobs.autoRun = []
  config.typescript.autoGenerate = false
  const { getPayloadClient } = await import('@/lib/payload')
  payload = await getPayloadClient()
  fixtures.sermons = bodies.map((_body, index) => ({
    id: randomUUID(), name: `Storage import ${randomUUID()}`, publishedAt: '2026-10-11T07:48:00Z',
    audioUrl: `https://example.test/${index === 1 ? 'second' : 'first'}`,
    authors: [], series: [], topics: [], scriptures: [], sermonScriptures: [],
  }))
}, 60_000)

afterAll(async () => {
  if (payload) {
    for (const id of sermonIds) await payload.delete({ collection: 'sermons', id, context: { skipCacheInvalidation: true } })
    for (const id of audioIds) await payload.delete({ collection: 'sermon-audio', id })
    const { waitForPayloadCleanup } = await import('@/workers/rock-sync')
    await waitForPayloadCleanup()
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
}, 30_000)

it.skipIf(!enabled)('uploads distinct files for consecutive imports through the actual Payload storage hooks', async () => {
  const { runSermonSync } = await import('./sermon-sync-runner')
  const results = await runSermonSync(2)
  for (const fixture of fixtures.sermons) {
    const documents = await payload.find({ collection: 'sermons', where: { resourceId: { equals: fixture.id } }, depth: 0 })
    for (const document of documents.docs) {
      sermonIds.push(document.id)
      if (typeof document.audio === 'number') audioIds.push(document.audio)
    }
  }
  expect(results.find(result => result.entity === 'sermons')).toMatchObject({ created: 2, errors: [] })
  expect(audioIds).toHaveLength(2)
  for (const [index, id] of audioIds.entries()) {
    const audio = await payload.findByID({ collection: 'sermon-audio', id, depth: 0 })
    expect(objects.get(audio.filename!)).toEqual(bodies[index])
  }
}, 60_000)
