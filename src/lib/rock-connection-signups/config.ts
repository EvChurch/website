const DEFAULT_ROCK_API_URL = 'https://rock.ev.church/api'

function requireServerSecret(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

export function getRockConnectionApiBaseUrl(): string {
  const configured = process.env.ROCK_API_URL || DEFAULT_ROCK_API_URL
  const url = new URL(configured)

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/api\/?$/.test(url.pathname)
  ) {
    throw new Error('ROCK_API_URL must be a fixed HTTPS Rock API origin')
  }

  url.pathname = '/api'
  return url.toString().replace(/\/$/, '')
}

export function getRockDiscoveryApiKey(): string {
  return requireServerSecret('ROCK_API_KEY')
}

export function getRockEdgeAccessHeaders(): Record<string, string> {
  return {
    'CF-Access-Client-Id': requireServerSecret('ROCK_EDGE_ACCESS_CLIENT_ID'),
    'CF-Access-Client-Secret': requireServerSecret(
      'ROCK_EDGE_ACCESS_CLIENT_SECRET',
    ),
  }
}
