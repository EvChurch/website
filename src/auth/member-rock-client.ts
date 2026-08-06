import { readMemberRockConfig } from './member-rock-config'

export interface MemberRockRequestOptions {
  endpoint: string
  params?: Record<string, string>
  retries?: number
  timeoutMs?: number
}

export class MemberRockAPIError extends Error {
  constructor(public readonly status: number) {
    super(`Member Rock API request failed with status ${status}`)
    this.name = 'MemberRockAPIError'
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function memberRockFetch<T>({
  endpoint,
  params,
  retries = 0,
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

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Authorization-Token': config.apiKey,
        },
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate: 0 },
      })
      if (!response.ok) throw new MemberRockAPIError(response.status)
      return (await response.json()) as T
    } catch (error) {
      const retryable =
        !(error instanceof MemberRockAPIError) ||
        error.status === 429 ||
        error.status >= 500
      if (!retryable || attempt === retries) throw error
      await wait(100 * 2 ** attempt)
    }
  }

  throw new Error('Unreachable')
}
