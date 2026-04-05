import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * Transcript sync endpoint. Queues a background job to fetch YouTube
 * transcripts and detect sermon boundaries for video-matched sermons.
 * GET /api/pipeline/transcript-sync?secret=...
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayloadClient()
    await payload.jobs.queue({ task: 'transcriptSync', input: {} })
    await payload.jobs.run({ queue: 'pipeline', limit: 1 })

    return NextResponse.json({ ok: true, message: 'Transcript sync job queued and executed' })
  } catch (error) {
    console.error('[Pipeline] Failed to queue transcript sync job:', error)
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    )
  }
}
