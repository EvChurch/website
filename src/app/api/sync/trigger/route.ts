import { NextRequest, NextResponse } from 'next/server'
import { runFullSync } from '@/sync/sync-runner'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { withRockSyncLock } from '@/lib/rock-sync-lock'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * Cron sync trigger endpoint.
 * Called every 15 minutes by an external cron service or Railway cron.
 *
 * Authorization: Bearer <CRON_SECRET>
 * Legacy query-string authentication remains supported for existing callers.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional limit for dev: ?limit=50 syncs only the latest 50 sermons
  const limitParam = request.nextUrl.searchParams.get('limit')
  const sermonLimit = limitParam ? parseInt(limitParam, 10) : undefined

  const startTime = Date.now()

  try {
    const lockResult = await withRockSyncLock(() => runFullSync({ sermonLimit }))
    if (!lockResult.acquired) {
      return NextResponse.json(
        { ok: false, error: 'Rock sync is already in progress' },
        { status: 409 },
      )
    }

    const results = lockResult.value
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
