import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, createLocalReq, type Payload, type PayloadRequest } from 'payload'
import type { SermonArticle } from '@/payload-types'
import { relationID } from '@/lib/sermon-management/drive'
import { readBlocks, verifyScripture, toLexical, type ArticleBlock, type ReviewQuestion } from './content'

export async function withArticle<T>(payload: Payload, id: number, fn: (article: SermonArticle, req: PayloadRequest) => Promise<T>) {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Article review requires database transactions.')
  const req = await createLocalReq({ req: { transactionID, context: { skipCacheInvalidation: true } } }, payload)
  try {
    const session = payload.db.sessions?.[transactionID] as { db: { execute(query: ReturnType<typeof sql>): Promise<unknown> } } | undefined
    if (!session) throw new Error('Database transaction unavailable.')
    await session.db.execute(sql`SELECT id FROM sermon_articles WHERE id = ${id} FOR UPDATE`)
    const article = await payload.findByID({ collection: 'sermon-articles', id, depth: 0, req })
    const result = await fn(article, req)
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

export function checkLease(article: Pick<SermonArticle, 'status' | 'leaseToken' | 'leaseExpiresAt'>, token: unknown) {
  const expires = Date.parse(article.leaseExpiresAt || '')
  if (article.status !== 'drafting' || !article.leaseToken || article.leaseToken !== token || !Number.isFinite(expires) || expires <= Date.now())
    throw new APIError('This drafting claim expired. Claim the article again.', 409)
}

export async function claimArticle(payload: Payload) {
  const candidates = await payload.find({ collection: 'sermon-articles', depth: 0, limit: 20, sort: 'createdAt', where: { and: [
    { status: { equals: 'drafting' } },
    { or: [{ leaseExpiresAt: { exists: false } }, { leaseExpiresAt: { less_than: new Date().toISOString() } }] },
  ] } })
  for (const candidate of candidates.docs) {
    const claimed = await withArticle(payload, candidate.id, async (article, req) => {
      if (article.status !== 'drafting' || (article.leaseExpiresAt && Date.parse(article.leaseExpiresAt) > Date.now())) return null
      return payload.update({ collection: 'sermon-articles', id: article.id, req, data: { leaseToken: randomUUID(), leaseExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString() } })
    })
    if (claimed) return { id: claimed.id, title: claimed.title, author: claimed.author, passageReference: claimed.passageReference, transcript: claimed.transcript, leaseToken: claimed.leaseToken }
  }
  return null
}

export async function submitDraft(payload: Payload, id: number, token: unknown, blocksInput: unknown, questionsInput: unknown) {
  const current = await payload.findByID({ collection: 'sermon-articles', id, depth: 0 })
  checkLease(current, token)
  if (!Array.isArray(questionsInput) || questionsInput.length > 100 || questionsInput.some((q) => typeof q !== 'string' || !q.trim() || q.length > 2000))
    throw new APIError('Supply a list of review questions.', 400)
  const blocks = await verifyScripture(readBlocks(blocksInput))
  const questions: ReviewQuestion[] = questionsInput.map((text: string) => ({ id: randomUUID(), text, resolved: false }))
  return withArticle(payload, id, async (article, req) => {
    checkLease(article, token)
    await payload.update({ collection: 'sermon-articles', id, req, data: {
      blocks, questions, status: 'review', reviewReadyAt: new Date().toISOString(), revision: randomUUID(), leaseToken: null, leaseExpiresAt: null, attempts: 0, error: null,
    } })
    return { status: 'review' }
  })
}

export function publicReview(article: SermonArticle) {
  return { id: article.id, title: article.title, author: article.author, status: article.status, blocks: article.blocks, questions: article.questions, revision: article.revision, blogPost: relationID(article.blogPost) }
}

export async function saveReview(payload: Payload, id: number, revision: unknown, blocksInput: unknown, resolvedInput: unknown, publish: boolean) {
  const blocks = await verifyScripture(readBlocks(blocksInput))
  if (!Array.isArray(resolvedInput) || resolvedInput.some((id) => typeof id !== 'string')) throw new APIError('Invalid resolved questions.', 400)
  return withArticle(payload, id, async (article, req) => {
    if (article.status === 'published') return publicReview(article)
    if (article.status !== 'review' || article.revision !== revision) throw new APIError('This article changed in another window. Reload before saving.', 409)
    const questions = (article.questions as unknown as ReviewQuestion[]).map((question) => ({ ...question, resolved: resolvedInput.includes(question.id) }))
    if (publish && questions.some((question) => !question.resolved)) throw new APIError('Resolve every review question before publishing.', 400)
    let blogPost = relationID(article.blogPost)
    if (publish) {
      const post = await payload.create({ collection: 'blog-posts', req, data: {
        title: article.title, slug: `sermon-${relationID(article.sermon)}-${article.id}`, author: article.author,
        sermon: relationID(article.sermon), sermonSeries: relationID(article.series), publishedDate: new Date().toISOString(),
        content: toLexical(blocks), isAiGenerated: true, aiDisclosure: '', _status: 'published',
        apiBibleFumsToken: blocks.flatMap((block: ArticleBlock) => block.type === 'scripture' ? [block.fumsToken] : []).join('\n'),
      } })
      blogPost = post.id
      await payload.update({ collection: 'sermons', id: relationID(article.sermon)!, req, data: { blogPost } })
    }
    const saved = await payload.update({ collection: 'sermon-articles', id, req, data: { blocks, questions, revision: randomUUID(), ...(publish ? { status: 'published', blogPost } : {}) } })
    return publicReview(saved)
  })
}
