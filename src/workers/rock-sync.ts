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
// Repeating a tag invalidation is safe; cap cache-only recovery at about 33 seconds.
const CACHE_REVALIDATION_TIMEOUT_MS = 10_000
const CACHE_REVALIDATION_ATTEMPTS = 3

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
  { wait = delay }: { wait?: (ms: number) => Promise<unknown> } = {},
): Promise<void> {
  const tags = cacheTagsForSyncResults(results)
  if (tags.length === 0) return

  const appBaseUrl = process.env.APP_BASE_URL
  const cronSecret = process.env.CRON_SECRET
  if (!appBaseUrl || !cronSecret) {
    throw new Error('APP_BASE_URL and CRON_SECRET are required for cache revalidation')
  }

  const url = new URL('/api/internal/cache/revalidate', appBaseUrl)
  for (let attempt = 1; attempt <= CACHE_REVALIDATION_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CACHE_REVALIDATION_TIMEOUT_MS)
    let failure: string
    let retryable = true
    try {
      const response = await fetcher(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cronSecret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tags }),
        signal: controller.signal,
      })
      // Only the status is needed; release the response on success and retries.
      void response.body?.cancel().catch(() => {})
      if (response.ok) return
      failure = `HTTP ${response.status}`
      retryable = response.status === 408 || response.status === 429 || response.status >= 500
    } catch (error: unknown) {
      // Never include URLs, headers or response bodies in operational errors.
      const cause = error instanceof Error ? error.cause : undefined
      const code = typeof cause === 'object' && cause !== null && 'code' in cause
        && typeof cause.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(cause.code)
        ? ` (${cause.code})` : ''
      failure = controller.signal.aborted ? 'request timed out' : `network error${code}`
    } finally {
      clearTimeout(timeout)
    }
    if (!retryable || attempt === CACHE_REVALIDATION_ATTEMPTS) {
      throw new Error(`Website cache revalidation failed after ${attempt} ${attempt === 1 ? 'attempt' : 'attempts'}: ${failure}`)
    }
    console.warn(JSON.stringify({ message: 'Retrying website cache revalidation', attempt, failure }))
    await wait(1000 * 2 ** (attempt - 1))
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
  console.log(JSON.stringify({ message: 'Rock sync data phase finished', results: lockResult.value }))
  // Refresh partial changes even when an entity failed, while retaining both failures.
  try {
    await notifyWebsite(lockResult.value)
  } catch (error: unknown) {
    if (errors.length > 0) {
      throw new Error(`Sync completed with errors: ${errors.join('; ')}; ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
    throw error
  }
  if (errors.length > 0) {
    throw new Error(`Sync completed with errors: ${errors.join('; ')}`)
  }

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
