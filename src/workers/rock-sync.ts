import { pathToFileURL } from 'node:url'

import {
  withRockSyncLock,
  type RockSyncLockResult,
} from '@/lib/rock-sync-lock'
import { destroyPayloadClient } from '@/lib/payload'
import { runFullSync, type SyncResult } from '@/sync/sync-runner'

const MAX_RUNTIME_MS = 14 * 60 * 1000

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

async function main() {
  const startedAt = Date.now()
  const watchdog = setTimeout(() => {
    console.error(JSON.stringify({
      message: 'Rock sync exceeded its maximum runtime',
      durationMs: Date.now() - startedAt,
    }))
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
  } finally {
    clearTimeout(watchdog)
    await destroyPayloadClient()
  }
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
