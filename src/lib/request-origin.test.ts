import { afterEach, describe, expect, it, vi } from 'vitest'

import { isSameOriginRequest } from './request-origin'

function request(origin: string | null, url: string) {
  return {
    headers: new Headers(origin ? { origin } : {}),
    nextUrl: new URL(url),
  }
}

describe('same-origin request validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('requires the complete origin, including the scheme and port', () => {
    expect(isSameOriginRequest(request('https://www.ev.church', 'https://www.ev.church/path'))).toBe(true)
    expect(isSameOriginRequest(request('http://www.ev.church', 'https://www.ev.church/path'))).toBe(false)
    expect(isSameOriginRequest(request('https://www.ev.church:444', 'https://www.ev.church/path'))).toBe(false)
  })

  it('uses the Railway public domain behind the production proxy', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'www.ev.church')

    const proxiedRequest = request(
      'https://www.ev.church',
      'https://0.0.0.0:3000/api/rock-entry-forms/example',
    )

    expect(isSameOriginRequest(proxiedRequest)).toBe(true)
    expect(isSameOriginRequest(request('http://www.ev.church', 'https://0.0.0.0:3000/path'))).toBe(false)
    expect(isSameOriginRequest(request('https://ev.church', 'https://0.0.0.0:3000/path'))).toBe(false)
    expect(isSameOriginRequest(request('https://www.ev.church:444', 'https://0.0.0.0:3000/path'))).toBe(false)
  })

  it('fails closed in production without a Railway public domain', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', '')

    expect(isSameOriginRequest(request('https://www.ev.church', 'https://www.ev.church/path'))).toBe(false)
  })

  it('fails closed in production with a malformed Railway public domain', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'not a valid hostname')

    expect(isSameOriginRequest(request('https://www.ev.church', 'https://www.ev.church/path'))).toBe(false)
  })
})
