import { createHash, randomBytes } from 'node:crypto'

import type { Payload } from 'payload'
import type { Pool } from 'pg'
import { sql } from '@payloadcms/db-postgres'

import { GIVING_FREQUENCIES, type GivingFrequency } from '@/lib/giving/blinkpay/types'
import { isGivingCapabilityToken } from '@/lib/giving/contracts'
import { drizzleResultRows } from '@/lib/rock-connection-signups/db-result'

export const GIVING_DRAFT_SESSION_PURPOSE = 'giving-draft-session-v1' as const
export type GivingDraftPurpose = typeof GIVING_DRAFT_SESSION_PURPOSE
export const GIVING_DRAFT_TTL_MS = 15 * 60 * 1000
export const GIVING_DRAFT_CLEANUP_LIMIT = 500
export function givingCapabilityCookieNames(secure: boolean) {
  return secure
    ? { guest: '__Host-ev_giving_guest', resume: '__Host-ev_giving_resume' }
    : { guest: 'ev_giving_guest', resume: 'ev_giving_resume' }
}

export interface GivingDraftAnswers {
  amountMinor: number
  fundId: number | null
  fundConfirmed: boolean
  frequency: GivingFrequency | null
  startDate: string | null
  firstName: string
  lastName: string
  email: string
}

export type GivingDraftBinding =
  | { audience: 'guest'; nonce: string }
  | { audience: 'member'; subject: string }

export interface GivingDraftRecord {
  tokenDigest: string
  bindingDigest: string
  purpose: GivingDraftPurpose
  audience: GivingDraftBinding['audience']
  answers: GivingDraftAnswers
  expiresAt: Date
  consumedAt: Date | null
}

export interface GivingDraftStore {
  create(record: GivingDraftRecord): Promise<void>
  read(input: {
    tokenDigest: string
    bindingDigest: string
    purpose: GivingDraftPurpose
    audience: GivingDraftBinding['audience']
    now: Date
  }): Promise<GivingDraftRecord | null>
  revoke(tokenDigest: string, now: Date): Promise<void>
}

export class GivingDraftCapabilityError extends Error {
  constructor() {
    super('Giving draft is unavailable')
    this.name = 'GivingDraftCapabilityError'
  }
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('base64url')
}

function bindingValue(binding: GivingDraftBinding) {
  return binding.audience === 'guest' ? binding.nonce : binding.subject
}

export function validateGivingDraftAnswers(value: unknown): GivingDraftAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GivingDraftCapabilityError()
  const candidate = value as Record<string, unknown>
  const keys = Object.keys(candidate).sort()
  const previousExpected = ['amountMinor', 'email', 'firstName', 'frequency', 'fundId', 'lastName', 'startDate'].sort()
  const expected = [...previousExpected, 'fundConfirmed'].sort()
  const legacyExpected = [...previousExpected, 'returnPathname'].sort()
  const matches = (shape: string[]) => keys.length === shape.length && keys.every((key, index) => key === shape[index])
  if (!matches(expected) && !matches(previousExpected) && !matches(legacyExpected)) throw new GivingDraftCapabilityError()
  const frequency = candidate.frequency
  const fundId = candidate.fundId
  const fundConfirmed = candidate.fundConfirmed ?? true
  if (!Number.isSafeInteger(candidate.amountMinor) || Number(candidate.amountMinor) <= 0 ||
      (fundId !== null && (!Number.isSafeInteger(fundId) || Number(fundId) <= 0)) ||
      (frequency !== null && !GIVING_FREQUENCIES.includes(frequency as GivingFrequency)) ||
      typeof fundConfirmed !== 'boolean' || (fundConfirmed && fundId === null) ||
      (frequency === null && candidate.startDate !== null) ||
      (candidate.startDate !== null && (typeof candidate.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(candidate.startDate))) ||
      typeof candidate.firstName !== 'string' || candidate.firstName.length > 150 ||
      typeof candidate.lastName !== 'string' || candidate.lastName.length > 150 ||
      typeof candidate.email !== 'string' || candidate.email.length > 320) {
    throw new GivingDraftCapabilityError()
  }
  return {
    amountMinor: Number(candidate.amountMinor),
    fundId: fundId === null ? null : Number(fundId),
    fundConfirmed,
    frequency: frequency as GivingFrequency | null,
    startDate: candidate.startDate as string | null,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
  }
}

export function createGivingDraftService(
  store: GivingDraftStore,
  dependencies: { randomBytes?: (size: number) => Buffer; now?: () => Date } = {},
) {
  const random = dependencies.randomBytes ?? randomBytes
  const currentTime = dependencies.now ?? (() => new Date())
  const issue = async (input: { answers: GivingDraftAnswers; binding: GivingDraftBinding }) => {
      const answers = validateGivingDraftAnswers(input.answers)
      const token = random(32).toString('base64url')
      const now = currentTime()
      await store.create({
        tokenDigest: digest(`${GIVING_DRAFT_SESSION_PURPOSE}\0${token}`),
        bindingDigest: digest(`${input.binding.audience}\0${bindingValue(input.binding)}`),
        purpose: GIVING_DRAFT_SESSION_PURPOSE,
        audience: input.binding.audience,
        answers,
        expiresAt: new Date(now.getTime() + GIVING_DRAFT_TTL_MS),
        consumedAt: null,
      })
      return { token, expiresAt: new Date(now.getTime() + GIVING_DRAFT_TTL_MS) }
  }
  return {
    createSession(input: { answers: GivingDraftAnswers; binding: GivingDraftBinding }) {
      return issue(input)
    },
    async readSession(input: { token: string; binding: GivingDraftBinding }) {
      if (!isGivingCapabilityToken(input.token)) throw new GivingDraftCapabilityError()
      const record = await store.read({
        tokenDigest: digest(`${GIVING_DRAFT_SESSION_PURPOSE}\0${input.token}`),
        bindingDigest: digest(`${input.binding.audience}\0${bindingValue(input.binding)}`),
        purpose: GIVING_DRAFT_SESSION_PURPOSE,
        audience: input.binding.audience,
        now: currentTime(),
      })
      if (!record) throw new GivingDraftCapabilityError()
      return validateGivingDraftAnswers(record.answers)
    },
    revokeSession(token: string) {
      if (!isGivingCapabilityToken(token)) return Promise.resolve()
      return store.revoke(digest(`${GIVING_DRAFT_SESSION_PURPOSE}\0${token}`), currentTime())
    },
  }
}

export function createPayloadGivingDraftStore(payload: Payload): GivingDraftStore {
  return {
    async create(record) {
      await payload.create({
        collection: 'giving-drafts',
        overrideAccess: true,
        data: {
          tokenDigest: record.tokenDigest,
          bindingDigest: record.bindingDigest,
          purpose: record.purpose,
          audience: record.audience,
          answers: { ...record.answers },
          expiresAt: record.expiresAt.toISOString(),
        },
      })
    },
    async read(input) {
      const result = await payload.db.drizzle.execute(sql`
        SELECT "token_digest", "binding_digest", "purpose", "audience", "answers", "expires_at", "consumed_at"
        FROM "giving_drafts"
        WHERE "token_digest" = ${input.tokenDigest}
          AND "binding_digest" = ${input.bindingDigest}
          AND "purpose" = ${input.purpose}
          AND "audience" = ${input.audience}
          AND "consumed_at" IS NULL
          AND "expires_at" > ${input.now}
        LIMIT 1
      `)
      return rowToRecord(drizzleResultRows(result)[0])
    },
    async revoke(tokenDigest, now) {
      await payload.db.drizzle.execute(sql`
        UPDATE "giving_drafts" SET "consumed_at" = ${now}, "updated_at" = ${now}
        WHERE "token_digest" = ${tokenDigest} AND "consumed_at" IS NULL
      `)
    },
  }
}

export async function cleanupGivingDrafts(pool: Pick<Pool, 'query'>, now = new Date()): Promise<number> {
  const result = await pool.query<{ deleted: number }>(`WITH candidates AS (
      SELECT id FROM giving_drafts
      WHERE consumed_at IS NOT NULL OR expires_at <= $1
      ORDER BY COALESCE(consumed_at,expires_at),id
      LIMIT $2 FOR UPDATE SKIP LOCKED
    ), deleted AS (
      DELETE FROM giving_drafts draft USING candidates
      WHERE draft.id=candidates.id RETURNING draft.id
    ) SELECT count(*)::int deleted FROM deleted`, [now,GIVING_DRAFT_CLEANUP_LIMIT])
  return Number(result.rows[0]?.deleted ?? 0)
}

function rowToRecord(value: unknown): GivingDraftRecord | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.token_digest !== 'string' || typeof row.binding_digest !== 'string' ||
      row.purpose !== GIVING_DRAFT_SESSION_PURPOSE ||
      !['guest', 'member'].includes(String(row.audience))) return null
  return {
    tokenDigest: row.token_digest,
    bindingDigest: row.binding_digest,
    purpose: GIVING_DRAFT_SESSION_PURPOSE,
    audience: row.audience as GivingDraftBinding['audience'],
    answers: validateGivingDraftAnswers(row.answers),
    expiresAt: new Date(String(row.expires_at)),
    consumedAt: row.consumed_at ? new Date(String(row.consumed_at)) : null,
  }
}
