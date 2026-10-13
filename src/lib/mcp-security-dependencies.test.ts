import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

// Resolve the dependencies actually consumed by Payload, not a separately
// installed test SDK or Express version.
const pluginRequire = createRequire(import.meta.resolve('@payloadcms/plugin-mcp'))
const sdkRequire = createRequire(pluginRequire.resolve('@modelcontextprotocol/sdk/server/mcp.js'))
const sdkAuth = pluginRequire.resolve('@modelcontextprotocol/sdk/client/auth.js')

interface OAuthProvider {
  clientInformation: () => { client_id: string; client_secret: string; issuer: string }
  clientMetadata: { scope: string }
  prepareTokenRequest: () => URLSearchParams
}
interface FetchToken {
  (provider: OAuthProvider, issuer: URL, options: { fetchFn: typeof fetch }): Promise<{ access_token: string }>
}

interface ExpressApp { set: (name: string, value: unknown) => void }
interface ExpressFactory { (): ExpressApp; request: object }

function requestIP(trust: string, remoteAddress: string, forwarded: string) {
  const express: ExpressFactory = sdkRequire('express')
  const app = express()
  app.set('trust proxy', trust)
  const req = { app, socket: { remoteAddress }, headers: { 'x-forwarded-for': forwarded } }
  return Reflect.get(express.request, 'ip', req)
}

describe('MCP dependency security request paths', () => {
  it('does not trust a public IPv4 hop via a short IPv4-mapped IPv6 subnet', () => {
    expect(requestIP('::ffff:10.0.0.0/8', '203.0.113.10', '198.51.100.99')).toBe('203.0.113.10')
    expect(requestIP('::/1', '203.0.113.10', '198.51.100.99')).toBe('203.0.113.10')
  })

  it('preserves legitimate forwarded IPs only behind the correctly specified trusted subnet', () => {
    for (const trust of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
      expect(requestIP(trust, '10.1.2.3', '198.51.100.99')).toBe('198.51.100.99')
      expect(requestIP(trust, '203.0.113.10', '198.51.100.99')).toBe('203.0.113.10')
    }
  })

  it('rejects sending issuer-bound client credentials to another authorization server', async () => {
    const { fetchToken }: { fetchToken: FetchToken } = await import(sdkAuth)
    const fetchFn = vi.fn<typeof fetch>(() => { throw new Error('No network allowed') })
    const provider: OAuthProvider = {
      clientInformation: () => ({ client_id: 'synthetic-client', client_secret: 'synthetic-secret', issuer: 'https://issuer.example.invalid' }),
      clientMetadata: { scope: 'read' },
      prepareTokenRequest: () => new URLSearchParams({ grant_type: 'client_credentials' }),
    }
    await expect(fetchToken(provider, new URL('https://other.example.invalid'), { fetchFn })).rejects.toThrow(/bound to authorization server/)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('keeps legitimate same-issuer token exchange working with synthetic HTTP responses', async () => {
    const { fetchToken }: { fetchToken: FetchToken } = await import(sdkAuth)
    const fetchFn = vi.fn<typeof fetch>(async () => Response.json({ access_token: 'synthetic-token', token_type: 'Bearer' }))
    const provider: OAuthProvider = {
      clientInformation: () => ({ client_id: 'synthetic-client', client_secret: 'synthetic-secret', issuer: 'https://issuer.example.invalid' }),
      clientMetadata: { scope: 'read' },
      prepareTokenRequest: () => new URLSearchParams({ grant_type: 'client_credentials' }),
    }
    expect((await fetchToken(provider, new URL('https://issuer.example.invalid'), { fetchFn })).access_token).toBe('synthetic-token')
    expect(fetchFn).toHaveBeenCalledOnce()
    expect(String(fetchFn.mock.calls[0][0])).toBe('https://issuer.example.invalid/token')
  })
})
