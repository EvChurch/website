import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ConnectionRateLimitError,
  createMemoryRateLimitStore,
  enforceConnectionRateLimit,
  trustedConnectionClientAddress,
} from './rate-limit'

describe('Rock Connection rate limiting', () => {
  beforeEach(() => {
    vi.stubEnv('ROCK_CONNECTION_RATE_LIMIT_SECRET', 'a'.repeat(32))
    vi.stubEnv('ROCK_CONNECTION_TRUST_CF_CONNECTING_IP', 'true')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('allows ten starts and five submits per fixed ten-minute window', async () => {
    const store = createMemoryRateLimitStore()
    for (let index = 0; index < 10; index += 1) {
      await expect(
        enforceConnectionRateLimit({
          address: '203.0.113.1',
          routeClass: 'start',
          store,
          now: 1_800_000_000_000,
        }),
      ).resolves.toBeUndefined()
    }
    await expect(
      enforceConnectionRateLimit({
        address: '203.0.113.1',
        routeClass: 'start',
        store,
        now: 1_800_000_000_000,
      }),
    ).rejects.toBeInstanceOf(ConnectionRateLimitError)

    for (let index = 0; index < 5; index += 1) {
      await expect(
        enforceConnectionRateLimit({
          address: '203.0.113.1',
          routeClass: 'submit',
          store,
          now: 1_800_000_000_000,
        }),
      ).resolves.toBeUndefined()
    }
    await expect(
      enforceConnectionRateLimit({
        address: '203.0.113.1',
        routeClass: 'submit',
        store,
        now: 1_800_000_000_000,
      }),
    ).rejects.toMatchObject({ retryAfterSeconds: expect.any(Number) })
  })

  it('limits person searches to thirty per fixed ten-minute window', async () => {
    const store = createMemoryRateLimitStore()
    for (let index = 0; index < 30; index += 1) {
      await expect(
        enforceConnectionRateLimit({
          address: '203.0.113.2',
          routeClass: 'personSearch',
          store,
          now: 1_800_000_000_000,
        }),
      ).resolves.toBeUndefined()
    }
    await expect(
      enforceConnectionRateLimit({
        address: '203.0.113.2',
        routeClass: 'personSearch',
        store,
        now: 1_800_000_000_000,
      }),
    ).rejects.toBeInstanceOf(ConnectionRateLimitError)
  })

  it('does not trust spoofable forwarding headers without the verified proxy contract', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ROCK_CONNECTION_TRUST_CF_CONNECTING_IP', 'false')
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.1',
      'x-forwarded-for': '198.51.100.2',
    })
    expect(() => trustedConnectionClientAddress(headers)).toThrow('unavailable')
  })

  it('uses an isolated local bucket and secret during development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ROCK_CONNECTION_RATE_LIMIT_SECRET', '')
    vi.stubEnv('ROCK_CONNECTION_TRUST_CF_CONNECTING_IP', 'false')

    const address = trustedConnectionClientAddress(new Headers())
    expect(address).toBe('127.0.0.1')
    await expect(
      enforceConnectionRateLimit({
        address,
        routeClass: 'start',
        store: createMemoryRateLimitStore(),
      }),
    ).resolves.toBeUndefined()
  })
})
