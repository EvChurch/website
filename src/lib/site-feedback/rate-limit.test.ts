import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMemorySiteFeedbackRateLimitStore,
  digestSiteFeedbackClientAddress,
  enforceSiteFeedbackRateLimit,
  SiteFeedbackRateLimitError,
  trustedSiteFeedbackClientAddress,
} from './rate-limit'

describe('site feedback rate limiting', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_FEEDBACK_RATE_LIMIT_SECRET', 'a'.repeat(32))
    vi.stubEnv('SITE_FEEDBACK_TRUST_CF_CONNECTING_IP', 'true')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('allows five submissions per fixed ten-minute window', async () => {
    const store = createMemorySiteFeedbackRateLimitStore()
    const now = 1_800_000_000_000

    for (let index = 0; index < 5; index += 1) {
      await expect(
        enforceSiteFeedbackRateLimit({
          address: '203.0.113.1',
          store,
          now,
        }),
      ).resolves.toBeUndefined()
    }

    await expect(
      enforceSiteFeedbackRateLimit({
        address: '203.0.113.1',
        store,
        now,
      }),
    ).rejects.toMatchObject({
      retryAfterSeconds: 600,
    })
  })

  it('uses independent buckets for independent clients and windows', async () => {
    const store = createMemorySiteFeedbackRateLimitStore()
    const firstWindow = 1_800_000_000_000

    for (let index = 0; index < 5; index += 1) {
      await enforceSiteFeedbackRateLimit({
        address: '203.0.113.1',
        store,
        now: firstWindow,
      })
    }

    await expect(
      enforceSiteFeedbackRateLimit({
        address: '203.0.113.2',
        store,
        now: firstWindow,
      }),
    ).resolves.toBeUndefined()
    await expect(
      enforceSiteFeedbackRateLimit({
        address: '203.0.113.1',
        store,
        now: firstWindow + 600_000,
      }),
    ).resolves.toBeUndefined()
  })

  it('fails closed when the rate-limit store is unavailable', async () => {
    const store = {
      increment: vi.fn().mockRejectedValue(new Error('database unavailable')),
    }

    await expect(
      enforceSiteFeedbackRateLimit({ address: '203.0.113.1', store }),
    ).rejects.toThrow('Site feedback rate limit is unavailable')
  })

  it('fails closed when the store returns an invalid count', async () => {
    const store = { increment: vi.fn().mockResolvedValue(Number.NaN) }

    await expect(
      enforceSiteFeedbackRateLimit({ address: '203.0.113.1', store }),
    ).rejects.toThrow('Site feedback rate limit is unavailable')
  })

  it('does not trust forwarded addresses without the verified proxy contract', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SITE_FEEDBACK_TRUST_CF_CONNECTING_IP', 'false')

    expect(() =>
      trustedSiteFeedbackClientAddress(
        new Headers({
          'cf-connecting-ip': '203.0.113.1',
          'x-forwarded-for': '198.51.100.2',
        }),
      ),
    ).toThrow('unavailable')
  })

  it('uses an isolated local address and secret outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SITE_FEEDBACK_RATE_LIMIT_SECRET', '')
    vi.stubEnv('SITE_FEEDBACK_TRUST_CF_CONNECTING_IP', 'false')

    const address = trustedSiteFeedbackClientAddress(new Headers())
    expect(address).toBe('127.0.0.1')
    expect(digestSiteFeedbackClientAddress(address)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('exposes a distinct error for an exhausted bucket', () => {
    expect(new SiteFeedbackRateLimitError(12)).toMatchObject({
      message: 'Too many requests',
      retryAfterSeconds: 12,
    })
  })
})
