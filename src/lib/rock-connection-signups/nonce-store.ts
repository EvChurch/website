import { createHash } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadClient } from '@/lib/payload'
import { drizzleResultRows } from './db-result'

export type ConnectionNonceRecord = {
  nonceDigest: string
  purpose: string
  pageGuid: string
  blockGuid: string
  expiresAt: Date
}

export type ConnectionNonceStore = {
  create(record: ConnectionNonceRecord): Promise<void>
  consume(record: ConnectionNonceRecord): Promise<boolean>
}

export function digestConnectionNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex')
}

export function createMemoryNonceStore(now = () => new Date()): ConnectionNonceStore {
  const records = new Map<string, ConnectionNonceRecord>()
  return {
    async create(record) {
      if (records.has(record.nonceDigest)) throw new Error('Nonce store unavailable')
      records.set(record.nonceDigest, record)
    },
    async consume(record) {
      const existing = records.get(record.nonceDigest)
      if (!existing || existing.expiresAt <= now() || existing.purpose !== record.purpose || existing.pageGuid !== record.pageGuid || existing.blockGuid !== record.blockGuid) return false
      records.delete(record.nonceDigest)
      return true
    },
  }
}

export function createPostgresNonceStore(): ConnectionNonceStore {
  return {
    async create(record) {
      const payload = await getPayloadClient()
      await payload.db.drizzle.execute(sql`
        INSERT INTO "rock_connection_signup_nonces"
          ("nonce_digest", "purpose", "page_guid", "block_guid", "expires_at")
        VALUES
          (${record.nonceDigest}, ${record.purpose}, ${record.pageGuid}, ${record.blockGuid}, ${record.expiresAt})
      `)
    },
    async consume(record) {
      const payload = await getPayloadClient()
      const result = await payload.db.drizzle.execute(sql`
        DELETE FROM "rock_connection_signup_nonces"
        WHERE "nonce_digest" = ${record.nonceDigest}
          AND "purpose" = ${record.purpose}
          AND "page_guid" = ${record.pageGuid}
          AND "block_guid" = ${record.blockGuid}
          AND "expires_at" > now()
        RETURNING "nonce_digest"
      `)
      return drizzleResultRows(result).length === 1
    },
  }
}
