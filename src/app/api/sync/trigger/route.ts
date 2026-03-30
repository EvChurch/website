import { NextRequest, NextResponse } from 'next/server'
import { runFullSync } from '@/sync/sync-runner'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * Cron sync trigger endpoint.
 * Called every 15 minutes by an external cron service or Railway cron.
 *
 * GET /api/sync/trigger?secret=...
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional limit for dev: ?limit=50 syncs only the latest 50 sermons
  const limitParam = request.nextUrl.searchParams.get('limit')
  const sermonLimit = limitParam ? parseInt(limitParam, 10) : undefined

  const startTime = Date.now()

  try {
    const results = await runFullSync({ sermonLimit })
    const duration = Date.now() - startTime

    const summary = results.map((r) => ({
      entity: r.entity,
      created: r.created,
      updated: r.updated,
      deleted: r.deleted,
      hasErrors: r.errors.length > 0,
    }))

    console.log(`[Sync] Full sync completed in ${duration}ms`, summary)

    return NextResponse.json({
      ok: true,
      duration: `${duration}ms`,
      results: summary,
      errors: results.flatMap((r) => r.errors),
    })
  } catch (error) {
    console.error('[Sync] Full sync failed:', error)
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    )
  }
}
