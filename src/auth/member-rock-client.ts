import { readMemberRockConfig } from './member-rock-config'

export interface MemberRockRequestOptions {
  endpoint: string
  params?: Record<string, string>
  timeoutMs?: number
}

export class MemberRockAPIError extends Error {
  constructor(public readonly status: number) {
    super(`Member Rock API request failed with status ${status}`)
    this.name = 'MemberRockAPIError'
  }
}

export async function memberRockFetch<T>({
  endpoint,
  params,
  timeoutMs = 5_000,
}: MemberRockRequestOptions): Promise<T> {
  const config = readMemberRockConfig()
  const relativeEndpoint = endpoint.replace(/^\/+/, '')
  const url = new URL(`${config.apiUrl}/${relativeEndpoint}`)
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value)
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Authorization-Token': config.apiKey,
    },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 },
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new MemberRockAPIError(response.status)
  }
  return (await response.json()) as T
}
