import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { GivingContext } from './contracts'
import { drizzleResultRows } from '@/lib/rock-connection-signups/db-result'

export const GIVING_E2E_SESSION_TTL_MS = 30 * 60 * 1000
export const GIVING_E2E_COOKIE = '__Host-ev_giving_e2e'
export const GIVING_E2E_CSRF_HEADER = 'x-ev-giving-e2e-csrf'

export interface GivingE2EAuthority extends GivingContext {
  id: number
  runId: string
  actorId: number
  expiresAt: Date
}

interface GivingE2ERunRecord extends GivingE2EAuthority {
  tokenDigest: string
  csrfDigest: string
  revokedAt: Date | null
}

export interface GivingE2ESessionStore {
  create(record: Omit<GivingE2ERunRecord, 'id' | 'revokedAt'>): Promise<GivingE2ERunRecord>
  find(tokenDigest: string): Promise<GivingE2ERunRecord | null>
  findActive(tokenDigest: string, now: Date): Promise<GivingE2ERunRecord | null>
  revoke(tokenDigest: string, csrfDigest: string, now: Date): Promise<boolean>
}

export class GivingE2ESessionError extends Error {
  constructor() {
    super('Giving E2E session unavailable')
    this.name = 'GivingE2ESessionError'
  }
}

function digest(purpose: 'session' | 'csrf', value: string) {
  return createHash('sha256').update(`giving-e2e-v1\0${purpose}\0${value}`).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function validToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/u.test(value)
}

function validRunId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value)
}

export function configuredGivingE2ETestAlias(value = process.env.GIVING_ROCK_E2E_PERSON_ALIAS_ID) {
  if (!value || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw new GivingE2ESessionError()
  }
  return Number(value)
}

export function createGivingE2ESessionService(
  store: GivingE2ESessionStore,
  dependencies: { now?: () => Date; randomBytes?: (size: number) => Buffer } = {},
) {
  const now = dependencies.now ?? (() => new Date())
  const random = dependencies.randomBytes ?? randomBytes
  return {
    async start(input: { actorId: number; runId: string }) {
      if (process.env.GIVING_E2E_ENABLED !== 'true' || !Number.isSafeInteger(input.actorId) || input.actorId <= 0 || !validRunId(input.runId)) {
        throw new GivingE2ESessionError()
      }
      configuredGivingE2ETestAlias()
      const token = random(32).toString('base64url')
      const csrf = random(32).toString('base64url')
      const current = now()
      const record = await store.create({
        runId: input.runId,
        actorId: input.actorId,
        contextKey: `sandbox:e2e:${input.runId}`,
        environment: 'sandbox',
        synthetic: true,
        e2eRunId: null,
        tokenDigest: digest('session', token),
        csrfDigest: digest('csrf', csrf),
        expiresAt: new Date(current.getTime() + GIVING_E2E_SESSION_TTL_MS),
      })
      return { token, csrf, authority: { ...record, e2eRunId: record.id } satisfies GivingE2EAuthority }
    },
    async read(token: string | undefined) {
      if (!token || !validToken(token)) return null
      const record = await store.findActive(digest('session', token), now())
      return record ? { ...record, e2eRunId: record.id } satisfies GivingE2EAuthority : null
    },
    async stop(input: { token: string | undefined; csrf: string | undefined; actorId: number }) {
      if (!input.token || !input.csrf || !validToken(input.token) || !validToken(input.csrf)) throw new GivingE2ESessionError()
      const current = now()
      const record = await store.find(digest('session', input.token))
      if (!record || record.actorId !== input.actorId) throw new GivingE2ESessionError()
      if (!safeEqual(record.csrfDigest, digest('csrf', input.csrf))) throw new GivingE2ESessionError()
      if (record.revokedAt) return
      if (record.expiresAt <= current) throw new GivingE2ESessionError()
      await store.revoke(record.tokenDigest, record.csrfDigest, current)
    },
  }
}

function row(value: unknown): GivingE2ERunRecord | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (!Number.isSafeInteger(Number(item.id)) || typeof item.run_id !== 'string' || typeof item.context_key !== 'string' || typeof item.token_digest !== 'string' || typeof item.csrf_digest !== 'string') return null
  return {
    id: Number(item.id), runId: item.run_id, contextKey: item.context_key,
    environment: 'sandbox', synthetic: true, e2eRunId: Number(item.id), actorId: Number(item.actor_id),
    tokenDigest: item.token_digest, csrfDigest: item.csrf_digest,
    expiresAt: new Date(String(item.expires_at)), revokedAt: item.revoked_at ? new Date(String(item.revoked_at)) : null,
  }
}

export function createPayloadGivingE2ESessionStore(payload: Payload): GivingE2ESessionStore {
  return {
    async create(record) {
      const result = await payload.db.drizzle.execute(sql`
        INSERT INTO giving_e2e_runs(run_id,context_key,environment,synthetic,actor_id,token_digest,csrf_digest,expires_at)
        VALUES(${record.runId},${record.contextKey},'sandbox',true,${record.actorId},${record.tokenDigest},${record.csrfDigest},${record.expiresAt})
        RETURNING id,run_id,context_key,actor_id,token_digest,csrf_digest,expires_at,revoked_at
      `)
      const created = row(drizzleResultRows(result)[0])
      if (!created) throw new GivingE2ESessionError()
      return created
    },
    async find(tokenDigest) {
      const result = await payload.db.drizzle.execute(sql`
        SELECT id,run_id,context_key,actor_id,token_digest,csrf_digest,expires_at,revoked_at
        FROM giving_e2e_runs WHERE token_digest=${tokenDigest} LIMIT 1
      `)
      return row(drizzleResultRows(result)[0])
    },
    async findActive(tokenDigest, now) {
      const result = await payload.db.drizzle.execute(sql`
        SELECT id,run_id,context_key,actor_id,token_digest,csrf_digest,expires_at,revoked_at
        FROM giving_e2e_runs WHERE token_digest=${tokenDigest} AND revoked_at IS NULL AND expires_at>${now} LIMIT 1
      `)
      return row(drizzleResultRows(result)[0])
    },
    async revoke(tokenDigest, csrfDigest, now) {
      const result = await payload.db.drizzle.execute(sql`
        UPDATE giving_e2e_runs SET revoked_at=COALESCE(revoked_at,${now}),updated_at=${now}
        WHERE token_digest=${tokenDigest} AND csrf_digest=${csrfDigest} AND revoked_at IS NULL
        RETURNING id
      `)
      return drizzleResultRows(result).length === 1
    },
  }
}
