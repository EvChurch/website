import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import type { Payload } from 'payload'
import type { SermonSetting, User } from '@/payload-types'
import { ffmpeg } from './audio'
import { beginProduction, changeProduction, publishProduction } from './workflow'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
const drive = vi.hoisted(() => ({ source: '', campus: 0 }))
vi.mock('./drive', async (original) => ({
  ...await original<typeof import('./drive')>(),
  getRecording: vi.fn(async () => ({ file: { id: 'integration-recording', name: 'test.mp3', modifiedTime: '2026-09-01T00:00:00Z', mimeType: 'audio/mpeg' }, campus: drive.campus })),
  downloadRecording: vi.fn(async (_settings, _id, _version, destination) => {
    await copyFile(drive.source, destination)
    return { name: 'test.mp3', mimeType: 'audio/mpeg' }
  }),
}))

describe.skipIf(process.env.RUN_SERMON_AUDIO_INTEGRATION !== 'true')('sermon audio workflow against local Postgres and FFmpeg', () => {
  let payload: Payload
  let directory: string
  let user: User
  let settings: SermonSetting
  let productionId: number | undefined
  let sermonId: number | undefined
  let audioId: number | undefined
  let speakerId: number
  let seriesId: number
  let topicId: number
  const files = new Set<number>()
  const relation = (value: number | { id: number } | null | undefined) => typeof value === 'number' ? value : value?.id
  beforeAll(async () => {
    const env = parse(await readFile('.env.local'))
    const url = new URL(env.DATABASE_URL)
    if (!url.pathname.startsWith('/evchurch_dev_wt_') || !['', 'localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Use a disposable worktree database.')
    Object.assign(process.env, env, { S3_BUCKET: '', RESEND_API_KEY: '', KRISP_API_KEY: '' })
    const { getPayload } = await import('payload')
    const { default: configPromise } = await import('@payload-config')
    const config = await configPromise
    config.jobs.autoRun = []
    payload = await getPayload({ config })
    settings = await payload.findGlobal({ slug: 'sermon-settings', depth: 0 })
    drive.campus = (await payload.create({ collection: 'campuses', data: { name: 'Audio test campus', slug: `audio-test-${randomUUID()}`, rockId: -Date.now() } })).id
    directory = await mkdtemp(path.join(tmpdir(), 'sermon-audio-integration-'))
    drive.source = path.join(directory, 'source.mp3')
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', drive.source])
    const outroPath = path.join(directory, 'outro.wav')
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', outroPath])
    const outro = await payload.create({ collection: 'sermon-work-files', data: {}, filePath: outroPath })
    files.add(outro.id)
    await payload.updateGlobal({ slug: 'sermon-settings', data: { intro: null, outro: outro.id } })
    const slug = `audio-test-${randomUUID()}`
    user = await payload.create({ collection: 'users', data: { name: 'Audio test manager', email: `${slug}@example.test`, auth0IdentityKey: slug, auth0Issuer: 'https://example.test', auth0Subject: slug, roles: ['sermon-manager'] } })
    speakerId = (await payload.create({ collection: 'speakers', data: { name: 'Audio test preacher', slug } })).id
    seriesId = (await payload.create({ collection: 'sermon-series', data: { title: 'Audio test series', slug } })).id
    topicId = (await payload.create({ collection: 'topics', data: { name: 'Audio test topic', slug } })).id
  }, 60_000)
  afterAll(async () => {
    if (!payload) return
    if (productionId) {
      const production = await payload.findByID({ collection: 'sermon-productions', id: productionId, depth: 0 })
      for (const value of [production.source, production.listeningCopy, production.output]) { const id = relation(value); if (id) files.add(id) }
      await payload.delete({ collection: 'payload-jobs', where: { 'input.productionId': { equals: productionId } } })
      await payload.delete({ collection: 'sermon-productions', id: productionId })
    }
    if (sermonId) await payload.delete({ collection: 'sermons', id: sermonId })
    if (audioId) await payload.delete({ collection: 'sermon-audio', id: audioId })
    for (const [collection, id] of [['speakers', speakerId], ['sermon-series', seriesId], ['topics', topicId], ['users', user?.id]] as const) if (id) await payload.delete({ collection, id })
    if (settings) await payload.updateGlobal({ slug: 'sermon-settings', data: { intro: relation(settings.intro) ?? null, outro: relation(settings.outro) ?? null } })
    if (drive.campus) await payload.delete({ collection: 'campuses', id: drive.campus })
    for (const id of files) await payload.delete({ collection: 'sermon-work-files', id })
    await payload.destroy()
    if (directory) await rm(directory, { recursive: true, force: true })
  })
  it('imports, renders an outro-only cut, requires a current preview, and publishes once', async () => {
    productionId = await beginProduction(payload, undefined, 'integration-recording')
    let production = await payload.findByID({ collection: 'sermon-productions', id: productionId, depth: 0 })
    sermonId = relation(production.sermon)
    expect(production.status).toBe('importing')
    await payload.jobs.run({ queue: 'sermon-audio', limit: 1 })
    production = await payload.findByID({ collection: 'sermon-productions', id: productionId, depth: 0 })
    expect(production.status, production.error || '').toBe('editable')
    expect(production.sourceDuration).toBeCloseTo(4, 1)
    const metadata = { title: 'Audio integration sermon', publishedAt: '2026-09-01T00:00:00Z', audioSpeaker: speakerId, audioCampus: drive.campus, passageReference: 'John 1:1', series: [seriesId], topics: [topicId], scriptures: [] }
    const oldToken = production.jobToken
    production = await changeProduction(payload, productionId, user, { action: 'render', token: oldToken, start: 1, end: 3, metadata })
    await payload.jobs.run({ queue: 'sermon-audio', limit: 1 })
    production = await payload.findByID({ collection: 'sermon-productions', id: productionId, depth: 0 })
    expect(production.status, production.error || '').toBe('ready')
    expect(production.outputDuration).toBeCloseTo(3, 1)
    expect(production.intro).toBeNull()
    await expect(publishProduction(payload, productionId, user, production.jobToken, false)).rejects.toThrow('confirm the preview')
    await expect(publishProduction(payload, productionId, user, oldToken, true)).rejects.toThrow('out of date')
    const results = await Promise.all([publishProduction(payload, productionId, user, production.jobToken, true), publishProduction(payload, productionId, user, production.jobToken, true)])
    audioId = relation(results[0].publishedAudio)
    expect(audioId).toBeTruthy()
    expect(relation(results[1].publishedAudio)).toBe(audioId)
    const sermon = await payload.findByID({ collection: 'sermons', id: sermonId!, depth: 0 })
    expect(sermon).toMatchObject({ isPublished: true, title: metadata.title, audio: audioId })
    expect(sermon.duration).toBeCloseTo(3, 1)
    const jobs = await payload.find({ collection: 'payload-jobs', where: { and: [{ taskSlug: { equals: 'prepareSermonArticle' } }, { 'input.productionId': { equals: productionId } }] } })
    expect(jobs.totalDocs).toBe(1)
  }, 60_000)
})
