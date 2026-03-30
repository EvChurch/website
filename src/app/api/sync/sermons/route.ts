import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * Sermon sync endpoint. Queues a background job instead of running inline.
 * GET /api/sync/sermons?secret=...
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayloadClient()
    await payload.jobs.queue({ task: 'fullSermonSync', input: {} })
    // Don't await run - let autoRun pick it up, or fire-and-forget
    void payload.jobs.run({ queue: 'default', limit: 1 })

    return NextResponse.json({ ok: true, message: 'Sermon sync job queued and started' })
  } catch (error) {
    console.error('[Sync] Failed to queue sermon sync job:', error)
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    )
  }
}
