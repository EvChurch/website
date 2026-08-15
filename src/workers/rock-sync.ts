import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import {
  withRockSyncLock,
  type RockSyncLockResult,
} from '@/lib/rock-sync-lock'
import { destroyPayloadClient } from '@/lib/payload'
import { notifyHeartbeat } from '@/lib/better-stack-heartbeat'
import { CACHE_TAGS, type CacheTag } from '@/lib/cache-tags'
import { runFullSync, type SyncResult } from '@/sync/sync-runner'

const MAX_RUNTIME_MS = 14 * 60 * 1000
const PAYLOAD_CLEANUP_TIMEOUT_MS = 5 * 1000

type WorkerResult =
  | { status: 'completed'; results: SyncResult[] }
  | { status: 'skipped'; reason: string }

type LockRunner = (
  operation: () => Promise<SyncResult[]>,
) => Promise<RockSyncLockResult<SyncResult[]>>

type WorkerDependencies = {
  runSync?: () => Promise<SyncResult[]>
  withLock?: LockRunner
  notifyWebsite?: (results: SyncResult[]) => Promise<void>
}

const SYNC_ENTITY_CACHE_TAGS: Readonly<Partial<Record<string, CacheTag>>> = {
  campuses: CACHE_TAGS.campuses,
  events: CACHE_TAGS.events,
  'team-members': CACHE_TAGS.teamMembers,
  'sermon-series': CACHE_TAGS.sermonSeries,
  sermons: CACHE_TAGS.sermons,
  speakers: CACHE_TAGS.speakers,
  topics: CACHE_TAGS.topics,
  categories: CACHE_TAGS.categories,
  scriptures: CACHE_TAGS.scriptures,
  'connect-groups': CACHE_TAGS.connectGroups,
  registrations: CACHE_TAGS.registrations,
  'daily-bible-readings': CACHE_TAGS.dailyBibleReadings,
  'service-guide-items': CACHE_TAGS.serviceGuide,
}

export function cacheTagsForSyncResults(results: SyncResult[]): CacheTag[] {
  const tags = results.flatMap((result) => {
    const changed = result.created + result.updated + result.deleted > 0
    const tag = SYNC_ENTITY_CACHE_TAGS[result.entity]
    return changed && tag ? [tag] : []
  })
  return [...new Set(tags)]
}

export async function notifyWebsiteCache(
  results: SyncResult[],
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const tags = cacheTagsForSyncResults(results)
  if (tags.length === 0) return

  const appBaseUrl = process.env.APP_BASE_URL
  const cronSecret = process.env.CRON_SECRET
  if (!appBaseUrl || !cronSecret) {
    throw new Error('APP_BASE_URL and CRON_SECRET are required for cache revalidation')
  }

  const response = await fetcher(new URL('/api/internal/cache/revalidate', appBaseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cronSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  })
  if (!response.ok) {
    throw new Error(`Website cache revalidation failed with status ${response.status}`)
  }
}

export async function notifyCompletedWorker(
  result: WorkerResult,
  notify: typeof notifyHeartbeat = notifyHeartbeat,
): Promise<void> {
  if (result.status === 'completed') {
    await notify(
      process.env.BETTER_STACK_ROCK_SYNC_HEARTBEAT_URL,
      'success',
    )
  }
}

export async function runRockSyncWorker({
  runSync = runFullSync,
  withLock = withRockSyncLock,
  notifyWebsite = notifyWebsiteCache,
}: WorkerDependencies = {}): Promise<WorkerResult> {
  const lockResult = await withLock(runSync)
  if (!lockResult.acquired) {
    return {
      status: 'skipped',
      reason: 'Rock sync is already in progress',
    }
  }

  const errors = lockResult.value.flatMap((result) =>
    result.errors.map((error) => `${result.entity}: ${error}`),
  )
  if (errors.length > 0) {
    throw new Error(`Sync completed with errors: ${errors.join('; ')}`)
  }

  await notifyWebsite(lockResult.value)

  return { status: 'completed', results: lockResult.value }
}

export async function waitForPayloadCleanup({
  destroy = destroyPayloadClient,
  timeoutMs = PAYLOAD_CLEANUP_TIMEOUT_MS,
}: {
  destroy?: () => Promise<void>
  timeoutMs?: number
} = {}): Promise<boolean> {
  return Promise.race([
    destroy().then(() => true),
    delay(timeoutMs, false, { ref: false }),
  ])
}

async function main() {
  const startedAt = Date.now()
  const watchdog = setTimeout(async () => {
    console.error(JSON.stringify({
      message: 'Rock sync exceeded its maximum runtime',
      durationMs: Date.now() - startedAt,
    }))
    await notifyHeartbeat(
      process.env.BETTER_STACK_ROCK_SYNC_HEARTBEAT_URL,
      'failure',
    )
    process.exit(1)
  }, MAX_RUNTIME_MS)
  watchdog.unref()

  try {
    const result = await runRockSyncWorker()

    console.log(JSON.stringify({
      message: result.status === 'completed'
        ? 'Rock sync completed'
        : 'Rock sync skipped',
      durationMs: Date.now() - startedAt,
      ...result,
    }))
    await notifyCompletedWorker(result)
  } finally {
    const cleanedUp = await waitForPayloadCleanup()
    if (!cleanedUp) {
      console.warn(JSON.stringify({
        message: 'Payload cleanup timed out; forcing worker exit',
        timeoutMs: PAYLOAD_CLEANUP_TIMEOUT_MS,
      }))
    }
    clearTimeout(watchdog)
  }
}

export async function runWorkerEntrypoint({
  run = main,
  exit = process.exit,
  notify = notifyHeartbeat,
}: {
  run?: () => Promise<void>
  exit?: (code: number) => void
  notify?: typeof notifyHeartbeat
} = {}): Promise<void> {
  try {
    await run()
    exit(0)
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error))
    await notify(process.env.BETTER_STACK_ROCK_SYNC_HEARTBEAT_URL, 'failure')
    exit(1)
  }
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void runWorkerEntrypoint()
}
