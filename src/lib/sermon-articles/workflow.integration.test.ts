import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { parse } from 'dotenv'
import { ffmpeg } from '@/lib/sermon-management/audio'
import { claimArticle, saveReview, submitDraft } from './workflow'
import { createArticleForProduction } from '@/jobs/sermon-articles'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
const rock = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/rock-api', () => ({ rockFetch: rock.fetch, RockAPIError: class extends Error {} }))
vi.mock('@/lib/api-bible', () => ({ fetchApiBibleCSBPassage: vi.fn(async () => ({ reference: 'John 1:1', content: 'Verified Scripture', copyright: 'CSB', fumsToken: 'test' })) }))

describe.skipIf(process.env.RUN_SERMON_ARTICLE_INTEGRATION !== 'true')('article workflow against local Postgres', () => {
  let payload: Payload
  let directory: string
  let sermonId: number
  let productionId: number
  let speakerId: number
  let fileId: number
  let articleId: number
  let transcriptId: number
  let audioId: number
  let blogId: number | undefined
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
    directory = await mkdtemp(path.join(tmpdir(), 'article-integration-'))
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', path.join(directory, 'sample.mp3')])
    fileId = (await payload.create({ collection: 'sermon-work-files', data: {}, filePath: path.join(directory, 'sample.mp3') })).id
    audioId = (await payload.create({ collection: 'sermon-audio', data: {}, filePath: path.join(directory, 'sample.mp3') })).id
    speakerId = (await payload.create({ collection: 'speakers', data: { name: 'Article test preacher', slug: `test-${randomUUID()}` } })).id
    sermonId = (await payload.create({ collection: 'sermons', data: { title: 'Article integration test', slug: `test-${randomUUID()}`, isPublished: false } })).id
    productionId = (await payload.create({ collection: 'sermon-productions', data: { sermon: sermonId, baseSermonRevision: 'test', sourceName: 'test', status: 'published', jobToken: randomUUID(), source: fileId, start: 0, end: 1, sourceDuration: 1, metadata: { title: 'Original title', audioSpeaker: speakerId } } })).id
    await payload.update({ collection: 'sermons', id: sermonId, data: { audio: audioId } })
    transcriptId = (await payload.create({ collection: 'sermon-transcripts', data: { sermon: sermonId, production: productionId, publishedAudio: audioId, title: 'Test', status: 'tagging', transcript: 'Timestamped sermon', audio: fileId } })).id
  }, 60_000)
  afterAll(async () => {
    if (!payload) return
    if (articleId) await payload.delete({ collection: 'sermon-articles', id: articleId })
    if (blogId) await payload.delete({ collection: 'blog-posts', id: blogId })
    if (transcriptId) await payload.delete({ collection: 'sermon-transcripts', id: transcriptId })
    if (audioId) await payload.delete({ collection: 'sermon-audio', id: audioId })
    if (productionId) await payload.delete({ collection: 'sermon-productions', id: productionId })
    if (sermonId) await payload.delete({ collection: 'sermons', id: sermonId })
    if (speakerId) await payload.delete({ collection: 'speakers', id: speakerId })
    if (fileId) await payload.delete({ collection: 'sermon-work-files', id: fileId })
    await payload.destroy()
    if (directory) await rm(directory, { recursive: true, force: true })
  })
  it('does nothing without a Rock person or email, then creates one immutable article', async () => {
    const count = () => payload.count({ collection: 'sermon-articles', where: { sermon: { equals: sermonId } } })
    await createArticleForProduction(payload, productionId)
    expect((await count()).totalDocs).toBe(0)
    expect(rock.fetch).not.toHaveBeenCalled()
    await payload.update({ collection: 'speakers', id: speakerId, data: { rockPersonId: 123 } })
    rock.fetch.mockResolvedValue({ Email: null })
    await createArticleForProduction(payload, productionId)
    expect((await count()).totalDocs).toBe(0)
    rock.fetch.mockResolvedValue({ Email: 'preacher@example.test' })
    await createArticleForProduction(payload, productionId)
    const articles = await payload.find({ collection: 'sermon-articles', depth: 0, where: { sermon: { equals: sermonId } } })
    articleId = articles.docs[0].id
    expect(articles.docs[0]).toMatchObject({ title: 'Original title', author: 'Article test preacher', status: 'drafting', transcript: 'Timestamped sermon' })
    await payload.update({ collection: 'sermons', id: sermonId, data: { title: 'Changed recording and title' } })
    await createArticleForProduction(payload, productionId)
    expect((await count()).totalDocs).toBe(1)
    expect((await payload.findByID({ collection: 'sermon-articles', id: articleId })).title).toBe('Original title')
  })
  it('serializes concurrent claims and rejects late drafts after review begins', async () => {
    await payload.update({ collection: 'sermon-articles', id: articleId, data: { status: 'drafting', transcript: 'The sermon' } })
    const claims = await Promise.all([claimArticle(payload), claimArticle(payload)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    const claim = claims.find(Boolean)!
    await submitDraft(payload, articleId, claim.leaseToken, [{ type: 'paragraph', text: 'A written article.' }, { type: 'scripture', reference: 'John 1:1' }], ['Check the interpretation.'])
    await expect(submitDraft(payload, articleId, claim.leaseToken, [{ type: 'paragraph', text: 'Late overwrite' }], [])).rejects.toThrow()
  })
  it('requires resolved questions, detects conflicts, and publishes exactly once with both links', async () => {
    const article = await payload.findByID({ collection: 'sermon-articles', id: articleId, depth: 0 })
    await expect(saveReview(payload, articleId, article.revision, article.blocks, [], true)).rejects.toThrow('Resolve every')
    await expect(saveReview(payload, articleId, 'old-revision', article.blocks, [], false)).rejects.toThrow('another window')
    const questions = article.questions as unknown as Array<{ id: string }>
    const attempts = await Promise.all([saveReview(payload, articleId, article.revision, article.blocks, questions.map((q) => q.id), true), saveReview(payload, articleId, article.revision, article.blocks, questions.map((q) => q.id), true)])
    expect(attempts[0].blogPost).toBe(attempts[1].blogPost)
    blogId = attempts[0].blogPost
    const post = await payload.findByID({ collection: 'blog-posts', id: blogId!, depth: 0 })
    expect(post).toMatchObject({ title: 'Original title', author: 'Article test preacher', sermon: sermonId, _status: 'published', aiDisclosure: '' })
    expect((await payload.findByID({ collection: 'sermons', id: sermonId, depth: 0 })).blogPost).toBe(blogId)
  })
})
