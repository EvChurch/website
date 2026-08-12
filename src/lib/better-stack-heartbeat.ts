type HeartbeatStatus = 'success' | 'failure'

type HeartbeatDependencies = {
  fetchImpl?: typeof fetch
  warn?: (message: string) => void
}

export async function notifyHeartbeat(
  configuredUrl: string | undefined,
  status: HeartbeatStatus,
  {
    fetchImpl = fetch,
    warn = (message) => console.warn(message),
  }: HeartbeatDependencies = {},
): Promise<boolean> {
  if (!configuredUrl) return false

  const heartbeatUrl = status === 'failure'
    ? `${configuredUrl.replace(/\/$/, '')}/fail`
    : configuredUrl

  try {
    const response = await fetchImpl(heartbeatUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error(`Heartbeat returned ${response.status}`)
    return true
  } catch {
    warn('Better Stack heartbeat delivery failed')
    return false
  }
}
