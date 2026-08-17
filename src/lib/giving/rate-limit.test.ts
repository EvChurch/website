import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enforceGivingRateLimits, GivingRateLimitError, trustedGivingClientAddress } from './rate-limit'

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

describe('giving checkout limits', () => {
  beforeEach(() => vi.stubEnv('GIVING_RATE_LIMIT_SECRET', 'r'.repeat(32)))
  afterEach(() => vi.unstubAllEnvs())

  it('allows a human to retry ten times in one window before limiting the identity', async () => {
    const counts = new Map<string, number>()
    const store = {
      async increment(input: { scope: 'client' | 'identity' }) {
        const count = (counts.get(input.scope) ?? 0) + 1
        counts.set(input.scope, count)
        return count
      },
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(enforceGivingRateLimits({
        address: '203.0.113.10',
        email: 'giver@example.com',
        store,
        now: Date.parse('2026-08-17T07:41:00Z'),
      })).resolves.toBeUndefined()
    }

    await expect(enforceGivingRateLimits({
      address: '203.0.113.10',
      email: 'giver@example.com',
      store,
      now: Date.parse('2026-08-17T07:41:00Z'),
    })).rejects.toBeInstanceOf(GivingRateLimitError)
  })

  it('allows twenty distinct identities from one client before limiting the address', async () => {
    const counts = new Map<string, number>()
    const store = {
      async increment(input: { bucketDigest: string }) {
        const count = (counts.get(input.bucketDigest) ?? 0) + 1
        counts.set(input.bucketDigest, count)
        return count
      },
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(enforceGivingRateLimits({
        address: '203.0.113.10',
        email: `giver-${attempt}@example.com`,
        store,
        now: Date.parse('2026-08-17T07:41:00Z'),
      })).resolves.toBeUndefined()
    }

    await expect(enforceGivingRateLimits({
      address: '203.0.113.10',
      email: 'giver-21@example.com',
      store,
      now: Date.parse('2026-08-17T07:41:00Z'),
    })).rejects.toBeInstanceOf(GivingRateLimitError)
  })

  it('gives authenticated members a separate, much higher retry allowance', async () => {
    const counts = new Map<string, number>()
    const store = {
      async increment(input: { bucketDigest: string }) {
        const count = (counts.get(input.bucketDigest) ?? 0) + 1
        counts.set(input.bucketDigest, count)
        return count
      },
    }

    for (let attempt = 0; attempt < 50; attempt += 1) {
      await expect(enforceGivingRateLimits({
        address: '203.0.113.10',
        email: 'member@example.com',
        memberSubject: 'auth0|member',
        store,
        now: Date.parse('2026-08-17T07:41:00Z'),
      })).resolves.toBeUndefined()
    }

    await expect(enforceGivingRateLimits({
      address: '203.0.113.10',
      email: 'member@example.com',
      memberSubject: 'auth0|member',
      store,
      now: Date.parse('2026-08-17T07:41:00Z'),
    })).rejects.toBeInstanceOf(GivingRateLimitError)
  })
})
