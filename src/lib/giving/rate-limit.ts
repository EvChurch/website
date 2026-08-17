import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import type { Pool } from 'pg'

const WINDOW_MS = 10 * 60_000

export interface GivingRateLimitStore {
  increment(input: { bucketDigest: string; scope: 'client' | 'identity'; windowStartedAt: Date; expiresAt: Date }): Promise<number>
}

export class GivingRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) { super('Giving checkout rate limited') }
}

function secret(value = process.env.GIVING_RATE_LIMIT_SECRET) {
  if (!value || Buffer.byteLength(value) < 32) throw new Error('Giving rate limit unavailable')
  return value
}

export function trustedGivingClientAddress(headers: Pick<Headers,'get'>) {
  if (process.env.NODE_ENV !== 'production') return '127.0.0.1'
  if (process.env.GIVING_TRUST_CF_CONNECTING_IP !== 'true') throw new Error('Giving rate limit unavailable')
  const value = headers.get('cf-connecting-ip')?.trim() ?? ''
  if (!isIP(value)) throw new Error('Giving rate limit unavailable')
  return value
}

function digest(scope: 'client' | 'identity', value: string) {
  return createHmac('sha256', secret()).update(`giving-rate-v1\0${scope}\0${value}`).digest('hex')
}

export async function enforceGivingRateLimits(input: { address: string; email: string; store: GivingRateLimitStore; now?: number }) {
  const now = input.now ?? Date.now()
  const windowStartedAt = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS)
  const expiresAt = new Date(windowStartedAt.getTime() + 2 * WINDOW_MS)
  const buckets = [
    { scope: 'client' as const, value: input.address, maximum: 5 },
    { scope: 'identity' as const, value: input.email.normalize('NFC').trim().toLowerCase(), maximum: 3 },
  ]
  for (const bucket of buckets) {
    const count = await input.store.increment({ bucketDigest: digest(bucket.scope,bucket.value), scope: bucket.scope, windowStartedAt, expiresAt })
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Giving rate limit unavailable')
    if (count > bucket.maximum) throw new GivingRateLimitError(Math.max(1,Math.ceil((windowStartedAt.getTime()+WINDOW_MS-now)/1000)))
  }
}

export function createPostgresGivingRateLimitStore(pool: Pool): GivingRateLimitStore {
  return { async increment(input) {
    const result = await pool.query<{ count: number }>(`WITH expired AS (SELECT id FROM giving_checkout_rate_limits WHERE expires_at<now() ORDER BY expires_at LIMIT 100), cleaned AS (DELETE FROM giving_checkout_rate_limits WHERE id IN(SELECT id FROM expired)) INSERT INTO giving_checkout_rate_limits(bucket_digest,scope,window_started_at,count,expires_at) VALUES($1,$2,$3,1,$4) ON CONFLICT(bucket_digest,scope,window_started_at) DO UPDATE SET count=giving_checkout_rate_limits.count+1 RETURNING count`,[input.bucketDigest,input.scope,input.windowStartedAt,input.expiresAt])
    return Number(result.rows[0]?.count)
  } }
}
