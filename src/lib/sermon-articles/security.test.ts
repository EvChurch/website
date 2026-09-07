import { afterEach, describe, expect, it, vi } from 'vitest'
import { reviewToken, reviewID, authorizeArticleWorker } from './security'
import { checkLease } from './workflow'
afterEach(() => vi.unstubAllEnvs())
describe('private article capabilities', () => {
  it('rejects forged IDs, signatures and signing keys', () => {
    const token = reviewToken(12, 'secret')
    expect(reviewID(token, 'secret')).toBe(12)
    expect(() => reviewID(token.replace('12.', '13.'), 'secret')).toThrow()
    expect(() => reviewID(token, 'other-secret')).toThrow()
    expect(() => reviewID('12.', 'secret')).toThrow()
  })
  it('fails closed without a sufficiently strong worker secret', () => {
    vi.stubEnv('SERMON_ARTICLE_WORKER_TOKEN', '')
    expect(() => authorizeArticleWorker(new Request('http://localhost'))).toThrow()
    vi.stubEnv('SERMON_ARTICLE_WORKER_TOKEN', 'a'.repeat(32))
    expect(() => authorizeArticleWorker(new Request('http://localhost', { headers: { authorization: `Bearer ${'a'.repeat(32)}` } }))).not.toThrow()
  })
  it('rejects stale or late drafting claims after review starts', () => {
    const lease = { status: 'drafting' as const, leaseToken: 'lease', leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() }
    expect(() => checkLease(lease, 'lease')).not.toThrow()
    expect(() => checkLease(lease, 'old-lease')).toThrow()
    expect(() => checkLease({ ...lease, status: 'review' }, 'lease')).toThrow()
    expect(() => checkLease({ ...lease, leaseExpiresAt: '2000-01-01' }, 'lease')).toThrow()
    expect(() => checkLease({ ...lease, leaseExpiresAt: null }, 'lease')).toThrow()
  })
})
