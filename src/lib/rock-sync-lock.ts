import { Client } from 'pg'

const ROCK_SYNC_LOCK_KEY = '4996835786959475528'

export type AdvisoryLockClient = {
  connect(): Promise<AdvisoryLockClient>
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>
  end(): Promise<void>
}

type RockSyncLockOptions = {
  connectionString?: string
  createClient?: (connectionString: string) => AdvisoryLockClient
}

export type RockSyncLockResult<T> =
  | { acquired: false }
  | { acquired: true; value: T }

export async function withRockSyncLock<T>(
  operation: () => Promise<T>,
  {
    connectionString = process.env.DATABASE_URL,
    createClient = (url) => new Client({ connectionString: url }),
  }: RockSyncLockOptions = {},
): Promise<RockSyncLockResult<T>> {
  if (!connectionString) throw new Error('DATABASE_URL is required for Rock sync locking')

  const client = createClient(connectionString)
  await client.connect()

  try {
    const lock = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [ROCK_SYNC_LOCK_KEY],
    )
    if (!lock.rows[0]?.acquired) return { acquired: false }

    try {
      return { acquired: true, value: await operation() }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ROCK_SYNC_LOCK_KEY])
    }
  } finally {
    await client.end()
  }
}
