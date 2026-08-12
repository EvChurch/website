import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadClient } from '@/lib/payload'
import { drizzleResultRows } from '@/lib/rock-connection-signups/db-result'

const WINDOW_MS = 10 * 60_000
const DEFAULT_MAXIMUM = 5

export type SiteFeedbackRateLimitRecord = {
  bucketDigest: string
  windowStartedAt: Date
  expiresAt: Date
}

export type SiteFeedbackRateLimitStore = {
  increment(record: SiteFeedbackRateLimitRecord): Promise<number>
}

export class SiteFeedbackRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many requests')
  }
}

function configuredSecret(): string {
  const value = (
    process.env.SITE_FEEDBACK_RATE_LIMIT_SECRET ||
    process.env.ROCK_CONNECTION_RATE_LIMIT_SECRET
  )?.trim()
  if (!value && process.env.NODE_ENV !== 'production') {
    return 'site-feedback-local-rate-limit-secret'
  }
  if (!value || Buffer.byteLength(value) < 32) {
    throw new Error('Site feedback rate limit is unavailable')
  }
  return value
}

export function trustedSiteFeedbackClientAddress(
  headers: Pick<Headers, 'get'>,
): string {
  const trustCloudflare =
    process.env.SITE_FEEDBACK_TRUST_CF_CONNECTING_IP ??
    process.env.ROCK_CONNECTION_TRUST_CF_CONNECTING_IP
  if (trustCloudflare !== 'true') {
    if (process.env.NODE_ENV !== 'production') return '127.0.0.1'
    throw new Error('Site feedback rate limit is unavailable')
  }

  const address = headers.get('cf-connecting-ip')?.trim() || ''
  if (!isIP(address)) {
    throw new Error('Site feedback rate limit is unavailable')
  }
  return address
}

export function digestSiteFeedbackClientAddress(address: string): string {
  return createHmac('sha256', configuredSecret())
    .update(`site-feedback-client\0${address}`)
    .digest('hex')
}

export function createPostgresSiteFeedbackRateLimitStore(): SiteFeedbackRateLimitStore {
  return {
    async increment(record) {
      const payload = await getPayloadClient()
      const result = await payload.db.drizzle.execute(sql`
        WITH expired AS (
          SELECT "id"
          FROM "site_feedback_rate_limits"
          WHERE "expires_at" < NOW()
          ORDER BY "expires_at" ASC
          LIMIT 100
        ), cleaned AS (
          DELETE FROM "site_feedback_rate_limits"
          WHERE "id" IN (SELECT "id" FROM expired)
        )
        INSERT INTO "site_feedback_rate_limits"
          ("bucket_digest", "window_started_at", "count", "expires_at")
        VALUES
          (${record.bucketDigest}, ${record.windowStartedAt}, 1, ${record.expiresAt})
        ON CONFLICT ("bucket_digest", "window_started_at")
        DO UPDATE SET "count" = "site_feedback_rate_limits"."count" + 1
        RETURNING "count"
      `)
      const row = drizzleResultRows(result)[0]
      const count =
        row && typeof row === 'object' && 'count' in row
          ? Number(row.count)
          : Number.NaN
      if (!Number.isSafeInteger(count) || count < 1) {
        throw new Error('Site feedback rate limit is unavailable')
      }
      return count
    },
  }
}

export function createMemorySiteFeedbackRateLimitStore(): SiteFeedbackRateLimitStore {
  const counters = new Map<string, number>()
  return {
    async increment(record) {
      const key = `${record.bucketDigest}:${record.windowStartedAt.toISOString()}`
      const count = (counters.get(key) || 0) + 1
      counters.set(key, count)
      return count
    },
  }
}

export async function enforceSiteFeedbackRateLimit({
  address,
  store = createPostgresSiteFeedbackRateLimitStore(),
  now = Date.now(),
}: {
  address: string
  store?: SiteFeedbackRateLimitStore
  now?: number
}): Promise<void> {
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS
  const configured = Number(
    process.env.SITE_FEEDBACK_SUBMIT_RATE_LIMIT || DEFAULT_MAXIMUM,
  )
  const maximum =
    Number.isSafeInteger(configured) && configured >= 1
      ? Math.min(DEFAULT_MAXIMUM, configured)
      : DEFAULT_MAXIMUM

  let count: number
  try {
    count = await store.increment({
      bucketDigest: digestSiteFeedbackClientAddress(address),
      windowStartedAt: new Date(windowStart),
      expiresAt: new Date(windowStart + 2 * WINDOW_MS),
    })
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error('Invalid rate-limit count')
    }
  } catch (error) {
    if (error instanceof SiteFeedbackRateLimitError) throw error
    throw new Error('Site feedback rate limit is unavailable', { cause: error })
  }

  if (count > maximum) {
    throw new SiteFeedbackRateLimitError(
      Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1_000)),
    )
  }
}
