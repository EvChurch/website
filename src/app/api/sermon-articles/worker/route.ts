import { claimTopics, submitTopics, checkTagLease, TOPIC_INSTRUCTIONS } from '@/lib/sermon-transcripts/workflow'
import { APIError } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { authorizeArticleWorker } from '@/lib/sermon-articles/security'
import { claimArticle, submitDraft, checkLease } from '@/lib/sermon-articles/workflow'
import { ARTICLE_INSTRUCTIONS } from '@/lib/sermon-articles/content'
import { streamWorkFile } from '@/lib/sermon-management/storage'
import { relationID } from '@/lib/sermon-management/drive'
import { fetchApiBibleCSBPassage } from '@/lib/api-bible'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    authorizeArticleWorker(request)
    const body = await request.json() as Record<string, unknown>
    const payload = await getPayloadClient()
    if (body.action === 'claim') {
      const topics = body.supportsTopics === true ? await claimTopics(payload) : null
      return Response.json({ article: topics || await claimArticle(payload), instructions: topics ? TOPIC_INSTRUCTIONS : ARTICLE_INSTRUCTIONS }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const id = Number(body.id)
    if (!Number.isSafeInteger(id) || id < 1) throw new APIError('Invalid article.', 400)
    if (body.kind === 'topics') {
      if (body.action === 'submit') return Response.json(await submitTopics(payload, id, body.leaseToken, body.topicIds, body.topicSuggestions))
      const job = await payload.findByID({ collection: 'sermon-transcripts', id, depth: 0 })
      checkTagLease(job, body.leaseToken)
      if (body.action === 'audio' && job.audio) return streamWorkFile(payload, relationID(job.audio)!, null)
      throw new APIError('Unknown topic worker action.', 400)
    }
    if (body.action === 'submit') return Response.json(await submitDraft(payload, id, body.leaseToken, body.blocks, body.questions))
    const article = await payload.findByID({ collection: 'sermon-articles', id, depth: 0 })
    checkLease(article, body.leaseToken)
    if (body.action === 'audio' && article.audio) return streamWorkFile(payload, relationID(article.audio)!, null)
    if (body.action === 'scripture' && typeof body.reference === 'string' && body.reference.length <= 200)
      return Response.json(await fetchApiBibleCSBPassage(body.reference), { headers: { 'Cache-Control': 'no-store' } })
    throw new APIError('Unknown worker action.', 400)
  } catch (error) {
    return Response.json({ error: error instanceof APIError ? error.message : 'Article worker request failed.' }, { status: error instanceof APIError ? error.status : 500 })
  }
}
