import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'
import { CACHE_TAGS } from '@/lib/cache-tags'

/**
 * YouTube sync endpoint. Queues a background job to fetch and match
 * YouTube videos to sermon records.
 * GET /api/pipeline/youtube-sync
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayloadClient()
    await payload.jobs.queue({ task: 'youtubeSync', input: {} })
    await payload.jobs.run({ queue: 'default', limit: 1 })

    revalidateTag(CACHE_TAGS.sermons, 'default')
    revalidateTag(CACHE_TAGS.sermonPipeline, 'default')

    return NextResponse.json({ ok: true, message: 'YouTube sync job queued and executed' })
  } catch (error) {
    console.error('[Pipeline] Failed to queue YouTube sync job:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
