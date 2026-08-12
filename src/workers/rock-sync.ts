import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import {
  withRockSyncLock,
  type RockSyncLockResult,
} from '@/lib/rock-sync-lock'
import { destroyPayloadClient } from '@/lib/payload'
import { notifyHeartbeat } from '@/lib/better-stack-heartbeat'
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
