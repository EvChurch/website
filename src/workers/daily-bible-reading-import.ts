import dotenv from 'dotenv'

function loadEnvironment(): void {
  dotenv.config({ path: process.env.ENV_FILE || '.env', quiet: true })
  dotenv.config({
    path: process.env.ENV_LOCAL_FILE || '.env.local',
    override: true,
    quiet: true,
  })
}

function assertSafeLocalDatabase(value: string | undefined): void {
  if (!value) throw new Error('DATABASE_URL is required')
  const url = new URL(value)
  const database = url.pathname.replace(/^\//, '')
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !database.endsWith('_dev')) {
    throw new Error('Daily Bible Reading import requires a local database ending in _dev')
  }
}

async function main(): Promise<void> {
  loadEnvironment()
  assertSafeLocalDatabase(process.env.DATABASE_URL)

  const [{ withRockSyncLock }, { destroyPayloadClient }, { syncDailyBibleReadings }] =
    await Promise.all([
      import('@/lib/rock-sync-lock'),
      import('@/lib/payload'),
      import('@/sync/daily-bible-readings'),
    ])
  try {
    const locked = await withRockSyncLock(async () => syncDailyBibleReadings())
    if (!locked.acquired) throw new Error('Rock sync is already in progress')
    if (locked.value.errors.length > 0) {
      throw new Error(locked.value.errors.join('; '))
    }
    console.log(JSON.stringify(locked.value))
  } finally {
    await destroyPayloadClient()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
