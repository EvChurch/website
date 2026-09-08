import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import type { Payload } from 'payload'
import { ffmpeg } from '@/lib/sermon-management/audio'
import { claimTopics, submitTopics, resolveTopicSuggestion } from './workflow'
import { prepareSermonTranscript } from '@/jobs/sermon-transcripts'
import { createArticleForProduction } from '@/jobs/sermon-articles'
import { resolveCalendarSeries } from '@/lib/sermon-management/calendar'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/sermon-articles/krisp', async original => ({
  ...await original<typeof import('@/lib/sermon-articles/krisp')>(),
  krispRequest: vi.fn(async () => ({ status: 'ready', meeting_id: 'test' })),
  krispSegments: vi.fn(async () => [{ text: 'Our hope is in Christ.', start: 0.2, end: 0.8 }]),
}))
vi.mock('@/lib/rock-api', () => ({ rockFetch: vi.fn(async () => ({ Email: 'preacher@example.test' })), RockAPIError: class extends Error {} }))

describe.skipIf(process.env.RUN_SERMON_ARTICLE_INTEGRATION !== 'true')('independent sermon transcripts against Postgres', () => {
  let payload: Payload
  let directory: string
  let sermonId: number
  let productionId: number
  let audioId: number
  let replacementAudioId: number
  let fileId: number
  let jobId: number
  let seriesId: number
  let speakerId: number
  const topicIds: number[] = []
  beforeAll(async () => {
    const env = parse(await readFile('.env.local'))
    const url = new URL(env.DATABASE_URL)
    if (!url.pathname.startsWith('/evchurch_dev_wt_') || !['', 'localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Use a disposable worktree database.')
    Object.assign(process.env, env, { S3_BUCKET: '', RESEND_API_KEY: '', KRISP_API_KEY: 'test' })
    const { getPayload } = await import('payload')
    const { default: configPromise } = await import('@payload-config')
    const config = await configPromise
    config.jobs.autoRun = []
    payload = await getPayload({ config })
    directory = await mkdtemp(path.join(tmpdir(), 'transcript-integration-'))
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', path.join(directory, 'sample.mp3')])
    fileId = (await payload.create({ collection: 'sermon-work-files', data: {}, filePath: path.join(directory, 'sample.mp3') })).id
    audioId = (await payload.create({ collection: 'sermon-audio', data: {}, filePath: path.join(directory, 'sample.mp3') })).id
    replacementAudioId = (await payload.create({ collection: 'sermon-audio', data: {}, filePath: path.join(directory, 'sample.mp3') })).id
    sermonId = (await payload.create({ collection: 'sermons', data: { title: 'Transcript test', slug: `test-${randomUUID()}`, audio: audioId } })).id
    productionId = (await payload.create({ collection: 'sermon-productions', data: { sermon: sermonId, baseSermonRevision: 'test', sourceName: 'test', status: 'published', jobToken: randomUUID(), source: fileId, intro: fileId, start: 0, end: 1, sourceDuration: 1 } })).id
    jobId = (await payload.create({ collection: 'sermon-transcripts', data: { sermon: sermonId, production: productionId, publishedAudio: audioId, title: 'Transcript test', status: 'transcribing', audio: fileId, krispImportId: 'test' } })).id
  }, 60_000)
  afterAll(async () => {
    if (!payload) return
    if (productionId) await payload.delete({ collection: 'payload-jobs', where: { 'input.productionId': { equals: productionId } } })
    if (jobId) await payload.delete({ collection: 'sermon-transcripts', id: jobId })
    if (productionId) await payload.delete({ collection: 'sermon-productions', id: productionId })
    if (sermonId) await payload.delete({ collection: 'sermons', id: sermonId })
    for (const id of [audioId, replacementAudioId]) if (id) await payload.delete({ collection: 'sermon-audio', id })
    if (fileId) await payload.delete({ collection: 'sermon-work-files', id: fileId })
    if (speakerId) await payload.delete({ collection: 'speakers', id: speakerId })
    if (seriesId) await payload.delete({ collection: 'sermon-series', id: seriesId })
    for (const id of topicIds) await payload.delete({ collection: 'topics', id })
    await payload.destroy()
    if (directory) await rm(directory, { recursive: true, force: true })
  })
  it('attaches an intro-offset transcript without any preacher or email', async () => {
    await prepareSermonTranscript(payload, jobId)
    const job = await payload.findByID({ collection: 'sermon-transcripts', id: jobId, depth: 0 })
    expect(job.status, job.error || '').toBe('tagging')
    const sermon = await payload.findByID({ collection: 'sermons', id: sermonId, depth: 0 })
    expect(sermon.audioTranscript).toEqual([{ text: 'Our hope is in Christ.', start: 0.2 + job.audioOffset!, end: 0.8 + job.audioOffset! }])
    expect(job.audioOffset).toBeCloseTo(1, 1)
    await createArticleForProduction(payload, productionId)
    expect((await payload.count({ collection: 'sermon-articles', where: { sermon: { equals: sermonId } } })).totalDocs).toBe(0)
  })
  it('serializes claims and approves a new topic with provenance', async () => {
    const claims = await Promise.all([claimTopics(payload), claimTopics(payload)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    const claim = claims.find(Boolean)!
    const name = `Hope ${randomUUID()}`
    await submitTopics(payload, jobId, claim.leaseToken, [], [name])
    await resolveTopicSuggestion(payload, sermonId, name, true)
    const sermon = await payload.findByID({ collection: 'sermons', id: sermonId, depth: 0 })
    expect(sermon.topicSuggestions).toBeNull()
    expect(sermon.generatedTopics).toEqual(sermon.topics)
    topicIds.push(...sermon.topics as number[])
    await expect(resolveTopicSuggestion(payload, sermonId, name, true)).rejects.toThrow('already')
    await expect(submitTopics(payload, jobId, claim.leaseToken, [], ['Late'])).rejects.toThrow('expired')
  })
  it('rejects old tagging and article work after audio replacement', async () => {
    speakerId = (await payload.create({ collection: 'speakers', data: { name: 'Test preacher', slug: `test-${randomUUID()}`, rockPersonId: 123 } })).id
    await payload.update({ collection: 'sermon-productions', id: productionId, data: { metadata: { audioSpeaker: speakerId, title: 'Old recording' } } })
    await payload.update({ collection: 'sermon-transcripts', id: jobId, data: { status: 'tagging', leaseToken: 'late', leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() } })
    await payload.update({ collection: 'sermons', id: sermonId, data: { audio: replacementAudioId, audioTranscript: null } })
    await createArticleForProduction(payload, productionId)
    expect((await payload.count({ collection: 'sermon-articles', where: { sermon: { equals: sermonId } } })).totalDocs).toBe(0)
    expect(await submitTopics(payload, jobId, 'late', [], ['Old subject'])).toEqual({ status: 'superseded' })
    expect((await payload.findByID({ collection: 'sermons', id: sermonId, depth: 0 })).audioTranscript).toBeNull()
  })
  it('creates only one series during concurrent campus imports', async () => {
    const title = `New series ${randomUUID()}`
    const ids = await Promise.all([resolveCalendarSeries(payload, title), resolveCalendarSeries(payload, ` ${title} `)])
    seriesId = ids[0]
    expect(ids[0]).toBe(ids[1])
  })
})
