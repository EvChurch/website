import { NextRequest, NextResponse } from 'next/server'
import { runSermonSync } from '@/sync/sermon-sync-runner'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * Sermon-only sync endpoint.
 * GET /api/sync/sermons?secret=...&limit=100
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const sermonLimit = limitParam ? parseInt(limitParam, 10) : undefined

  const startTime = Date.now()

  try {
    const results = await runSermonSync(sermonLimit)
    const duration = Date.now() - startTime

    const summary = results.map((r) => ({
      entity: r.entity,
      created: r.created,
      updated: r.updated,
      deleted: r.deleted,
      hasErrors: r.errors.length > 0,
    }))

    return NextResponse.json({
      ok: true,
      duration: `${duration}ms`,
      results: summary,
      errors: results.flatMap((r) => r.errors),
    })
  } catch (error) {
    console.error('[Sync] Sermon sync failed:', error)
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    )
  }
}
