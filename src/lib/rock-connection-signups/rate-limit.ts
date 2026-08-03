import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadClient } from '@/lib/payload'
import { drizzleResultRows } from './db-result'

export type ConnectionRateClass = 'start' | 'submit'

export type ConnectionRateLimitRecord = {
  bucketDigest: string
  routeClass: ConnectionRateClass
  windowStartedAt: Date
  expiresAt: Date
}

export type ConnectionRateLimitStore = {
  increment(record: ConnectionRateLimitRecord): Promise<number>
}

export class ConnectionRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many requests')
  }
}

function secret(): string {
  const value = process.env.ROCK_CONNECTION_RATE_LIMIT_SECRET?.trim()
  if (!value || Buffer.byteLength(value) < 32) {
    throw new Error('Connection rate limit is unavailable')
  }
  return value
}

export function trustedConnectionClientAddress(headers: Pick<Headers, 'get'>): string {
  if (process.env.ROCK_CONNECTION_TRUST_CF_CONNECTING_IP !== 'true') {
    throw new Error('Connection rate limit is unavailable')
  }
  const address = headers.get('cf-connecting-ip')?.trim() || ''
  if (!isIP(address)) throw new Error('Connection rate limit is unavailable')
  return address
}

export function digestConnectionClientAddress(address: string): string {
  return createHmac('sha256', secret()).update(`rock-connection-client\0${address}`).digest('hex')
}

export function createPostgresRateLimitStore(): ConnectionRateLimitStore {
  return {
    async increment(record) {
      const payload = await getPayloadClient()
      const result = await payload.db.drizzle.execute(sql`
        INSERT INTO "rock_connection_signup_rate_limits"
          ("bucket_digest", "route_class", "window_started_at", "count", "expires_at")
        VALUES
          (${record.bucketDigest}, ${record.routeClass}, ${record.windowStartedAt}, 1, ${record.expiresAt})
        ON CONFLICT ("bucket_digest", "route_class", "window_started_at")
        DO UPDATE SET "count" = "rock_connection_signup_rate_limits"."count" + 1
        RETURNING "count"
      `)
      const row = drizzleResultRows(result)[0]
      const count = row && typeof row === 'object' && 'count' in row ? Number(row.count) : NaN
      if (!Number.isSafeInteger(count) || count < 1) throw new Error('Connection rate limit is unavailable')
      return count
    },
  }
}

export function createMemoryRateLimitStore(): ConnectionRateLimitStore {
  const counters = new Map<string, number>()
  return {
    async increment(record) {
      const key = `${record.bucketDigest}:${record.routeClass}:${record.windowStartedAt.toISOString()}`
      const count = (counters.get(key) || 0) + 1
      counters.set(key, count)
      return count
    },
  }
}

export async function enforceConnectionRateLimit({
  address,
  routeClass,
  store = createPostgresRateLimitStore(),
  now = Date.now(),
}: {
  address: string
  routeClass: ConnectionRateClass
  store?: ConnectionRateLimitStore
  now?: number
}): Promise<void> {
  const windowMs = 10 * 60_000
  const windowStart = Math.floor(now / windowMs) * windowMs
  const defaultMaximum = routeClass === 'start' ? 10 : 5
  const configured = Number(
    routeClass === 'start'
      ? process.env.ROCK_CONNECTION_START_RATE_LIMIT || defaultMaximum
      : process.env.ROCK_CONNECTION_SUBMIT_RATE_LIMIT || defaultMaximum,
  )
  const maximum = Number.isSafeInteger(configured) && configured >= 1
    ? Math.min(defaultMaximum, configured)
    : defaultMaximum
  const count = await store.increment({
    bucketDigest: digestConnectionClientAddress(address),
    routeClass,
    windowStartedAt: new Date(windowStart),
    expiresAt: new Date(windowStart + 2 * windowMs),
  })
  if (count > maximum) {
    throw new ConnectionRateLimitError(Math.max(1, Math.ceil((windowStart + windowMs - now) / 1_000)))
  }
}
