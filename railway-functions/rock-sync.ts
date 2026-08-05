type SyncEntityResult = {
  entity: string
  created: number
  updated: number
  deleted: number
  hasErrors: boolean
}

export type SyncResponse = {
  ok: boolean
  duration: string
  results: SyncEntityResult[]
  errors: string[]
}

type TriggerOptions = {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 14 * 60 * 1000

export async function triggerRockSync({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TriggerOptions = {}): Promise<SyncResponse> {
  const secret = env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET is required')

  const syncUrl = env.SYNC_URL
  if (!syncUrl) throw new Error('SYNC_URL is required')
  const response = await fetchImpl(syncUrl, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(
      `Sync request failed with HTTP ${response.status}: ${responseText.slice(0, 500)}`,
    )
  }

  let result: SyncResponse
  try {
    result = JSON.parse(responseText) as SyncResponse
  } catch {
    throw new Error('Sync request returned invalid JSON')
  }

  if (!result.ok) throw new Error('Sync endpoint reported failure')
  if (result.errors.length > 0) {
    throw new Error(`Sync completed with errors: ${result.errors.join('; ')}`)
  }
  const failedEntities = result.results.filter((entity) => entity.hasErrors)
  if (failedEntities.length > 0) {
    throw new Error(
      `Sync reported failed entities: ${failedEntities.map((entity) => entity.entity).join(', ')}`,
    )
  }

  return result
}

if (process.env.NODE_ENV !== 'test') {
  triggerRockSync()
    .then((result) => {
      console.log(
        JSON.stringify({
          message: 'Rock sync completed',
          duration: result.duration,
          results: result.results,
        }),
      )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
