import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * YouTube sync endpoint. Queues a background job to fetch and match
 * YouTube videos to sermon records.
 * GET /api/pipeline/youtube-sync?secret=...
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayloadClient()
    await payload.jobs.queue({ task: 'youtubeSync', input: {} })
    // Run synchronously so we can report the result
    await payload.jobs.run({ queue: 'default', limit: 1 })

    return NextResponse.json({ ok: true, message: 'YouTube sync job queued and executed' })
  } catch (error) {
    console.error('[Pipeline] Failed to queue YouTube sync job:', error)
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    )
  }
}
