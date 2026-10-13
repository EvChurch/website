import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withRockSyncLock } from '@/lib/rock-sync-lock'
import { runSermonSync } from '@/sync/sermon-sync-runner'
import { cacheTagsForSyncResults } from '@/workers/rock-sync'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await withRockSyncLock(() => runSermonSync())
    if (!result.acquired)
      return NextResponse.json({ ok: false, error: 'Sync is already in progress.' }, { status: 409 })

    for (const tag of cacheTagsForSyncResults(result.value))
      revalidateTag(tag, { expire: 0 })

    const errors = result.value.reduce((sum, entity) => sum + entity.errors.length, 0)
    return NextResponse.json(
      { ok: errors === 0, created: result.value.reduce((sum, entity) => sum + entity.created, 0), errors },
      { status: errors ? 500 : 200 },
    )
  } catch (error) {
    console.error('[SermonSync] Import failed:', error instanceof Error ? error.name : 'Unknown error')
    return NextResponse.json({ ok: false, error: 'Sermon import failed. Please try again.' }, { status: 500 })
  }
}
