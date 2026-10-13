import { NextRequest } from 'next/server'
import { APIError } from 'payload'
import { revalidateTag } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'
import { reviewID } from '@/lib/sermon-articles/security'
import { publicReview, saveReview } from '@/lib/sermon-articles/workflow'
import { isSameOriginRequest } from '@/lib/request-origin'
import { streamWorkFile } from '@/lib/sermon-management/storage'
import { relationID } from '@/lib/sermon-management/drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' }
function failure(error: unknown) {
  return Response.json({ error: error instanceof APIError ? error.message : 'Unable to save this article. Please try again.' }, { status: error instanceof APIError ? error.status : 500, headers: privateHeaders })
}
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayloadClient()
    const audioId = request.nextUrl.searchParams.get('audio')
    const token = request.headers.get('x-sermon-review') || (audioId && /^\d+$/.test(audioId) ? request.cookies.get(`sermon-review-${audioId}`)?.value : '') || ''
    const id = reviewID(token, payload.secret)
    const article = await payload.findByID({ collection: 'sermon-articles', id, depth: 0 })
    if (!['review', 'published'].includes(article.status)) throw new APIError('Article review is not ready.', 404)
    if (request.nextUrl.searchParams.has('audio')) {
      if (audioId !== String(id)) throw new APIError('Audio unavailable.', 404)
      if (!article.audio) throw new APIError('Audio unavailable.', 404)
      return streamWorkFile(payload, relationID(article.audio)!, request.headers.get('range'))
    }
    return Response.json(publicReview(article), { headers: { ...privateHeaders, 'Set-Cookie': `sermon-review-${id}=${token}; Path=/api/sermon-articles/review; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` } })
  } catch (error) { return failure(error) }
}
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) throw new APIError('Invalid request origin.', 403)
    const payload = await getPayloadClient()
    const id = reviewID(request.headers.get('x-sermon-review') || '', payload.secret)
    const body = await request.json() as Record<string, unknown>
    if (!['save', 'publish'].includes(String(body.action))) throw new APIError('Unknown action.', 400)
    const result = await saveReview(payload, id, body.revision, body.blocks, body.resolvedQuestions, body.action === 'publish')
    if (body.action === 'publish') { revalidateTag('blog-posts', 'default'); revalidateTag('sermons', 'default') }
    return Response.json(result, { headers: privateHeaders })
  } catch (error) { return failure(error) }
}
