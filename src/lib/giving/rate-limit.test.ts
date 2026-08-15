import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { trustedGivingClientAddress } from './rate-limit'

describe('giving client address trust', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('defaults Cloudflare forwarding trust off and documents the origin restriction', () => {
    const example = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8')
    expect(example).toContain('GIVING_TRUST_CF_CONNECTING_IP=false')
    expect(example).toMatch(/origin accepts traffic exclusively from trusted Cloudflare proxies/u)
  })

  it('uses CF-Connecting-IP in production only after explicit trusted-proxy opt-in', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GIVING_TRUST_CF_CONNECTING_IP', 'false')
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.10' })
    expect(() => trustedGivingClientAddress(headers)).toThrow(/unavailable/u)
    vi.stubEnv('GIVING_TRUST_CF_CONNECTING_IP', 'true')
    expect(trustedGivingClientAddress(headers)).toBe('203.0.113.10')
  })
})
