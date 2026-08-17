import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { GivingEnvironment } from './contracts'
import { BlinkPayClientError } from './blinkpay/client'
import type { BlinkPayFixedRecurringPayment, BlinkPayMutationResult, BlinkPayOperationKeys } from './blinkpay/types'

const NONCE_TTL_MS = 5 * 60 * 1_000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

export class GivingCancellationError extends Error {
  constructor(public readonly code: 'not-active' | 'confirmation-invalid' | 'conflict') {
    super(`Giving cancellation failed: ${code}`)
    this.name = 'GivingCancellationError'
  }
}

export interface CancellationTarget {
  scheduleId: number
  checkoutId: number
  environment: GivingEnvironment
  providerScheduleId: string
  actorId: number
  reason: string
  operationId: number
  keys: BlinkPayOperationKeys
}

export interface GivingCancellationStore {
  issueNonce(input: { actorId: number; scheduleId: number; reasonDigest: string; tokenDigest: string; now: Date; expiresAt: Date }): Promise<void>
  begin(input: { actorId: number; scheduleId: number; reason: string; reasonDigest: string; tokenDigest: string; now: Date; requestId: string; idempotencyKey: string }): Promise<CancellationTarget>
  finish(input: { target: CancellationTarget; outcome: 'cancelled' | 'unknown' | 'recoverable'; now: Date; providerRequestId?: string; providerStatus?: string; errorCode?: string }): Promise<void>
}

export interface GivingCancellationProvider {
  cancelFixedRecurringPayment(id: string, keys: BlinkPayOperationKeys): Promise<BlinkPayMutationResult<undefined>>
  getFixedRecurringPayment(id: string): Promise<BlinkPayFixedRecurringPayment>
}

function digest(purpose: string, value: string) {
  return createHash('sha256').update(`${purpose}\0${value}`).digest('hex')
}

export function normalizeCancellationReason(value: unknown): string {
  if (typeof value !== 'string') throw new GivingCancellationError('confirmation-invalid')
  const reason = value.trim().replace(/\s+/gu, ' ')
  if (reason.length < 3 || reason.length > 500 || CONTROL_CHARACTERS.test(reason)) throw new GivingCancellationError('confirmation-invalid')
  return reason
}

function validToken(value: string) {
  if (!TOKEN_PATTERN.test(value)) return false
  const expected = Buffer.from(value)
  return timingSafeEqual(expected, Buffer.from(value))
}

export function createGivingCancellationService(dependencies: {
  store: GivingCancellationStore
  provider(environment: GivingEnvironment): GivingCancellationProvider
  now?: () => Date
  randomToken?: () => string
  randomId?: () => string
}) {
  const now = dependencies.now ?? (() => new Date())
  const randomToken = dependencies.randomToken ?? (() => randomBytes(32).toString('base64url'))
  const randomId = dependencies.randomId ?? randomUUID
  return {
    async prepare(input: { actorId: number; scheduleId: number; reason: unknown }) {
      const reason = normalizeCancellationReason(input.reason)
      const token = randomToken()
      if (!validToken(token)) throw new GivingCancellationError('confirmation-invalid')
      const issuedAt = now()
      await dependencies.store.issueNonce({ actorId: input.actorId, scheduleId: input.scheduleId, reasonDigest: digest('giving-cancel-reason-v1', reason), tokenDigest: digest('giving-cancel-nonce-v1', token), now: issuedAt, expiresAt: new Date(issuedAt.getTime() + NONCE_TTL_MS) })
      return { nonce: token, expiresAt: new Date(issuedAt.getTime() + NONCE_TTL_MS).toISOString() }
    },
    async confirm(input: { actorId: number; scheduleId: number; reason: unknown; nonce: unknown }) {
      const reason = normalizeCancellationReason(input.reason)
      if (typeof input.nonce !== 'string' || !validToken(input.nonce)) throw new GivingCancellationError('confirmation-invalid')
      const at = now()
      const target = await dependencies.store.begin({
        actorId: input.actorId, scheduleId: input.scheduleId, reason,
        reasonDigest: digest('giving-cancel-reason-v1', reason), tokenDigest: digest('giving-cancel-nonce-v1', input.nonce), now: at,
        requestId: `giving-cancel-request:${randomId()}`, idempotencyKey: `giving-cancel-idempotency:${randomId()}`,
      })
      let result: BlinkPayMutationResult<undefined>
      try {
        result = await dependencies.provider(target.environment).cancelFixedRecurringPayment(target.providerScheduleId, target.keys)
      } catch (error) {
        const definitiveRejection = error instanceof BlinkPayClientError && error.code === 'request-rejected' && typeof error.status === 'number' && error.status >= 400 && error.status < 500
        await dependencies.store.finish({ target, outcome: definitiveRejection ? 'recoverable' : 'unknown', now: now(), providerRequestId: error instanceof BlinkPayClientError ? error.metadata?.correlationId ?? error.metadata?.requestId : undefined, errorCode: definitiveRejection ? 'provider-rejected' : 'cancellation-ambiguous' })
        return { status: definitiveRejection ? 'not-cancelled' as const : 'unknown' as const }
      }
      if (result.outcome === 'succeeded') {
        await dependencies.store.finish({ target, outcome: 'cancelled', now: now(), providerRequestId: result.metadata.correlationId ?? result.metadata.requestId, providerStatus: 'cancelled' })
        return { status: 'cancelled' as const }
      }
      let observed: BlinkPayFixedRecurringPayment | undefined
      try { observed = await dependencies.provider(target.environment).getFixedRecurringPayment(target.providerScheduleId) }
      catch { /* authoritative read remains an operational unknown */ }
      if (observed && /cancel/iu.test(observed.status)) {
        await dependencies.store.finish({ target, outcome: 'cancelled', now: now(), providerRequestId: result.metadata.correlationId ?? result.metadata.requestId, providerStatus: observed.status })
        return { status: 'cancelled' as const }
      }
      await dependencies.store.finish({ target, outcome: 'unknown', now: now(), providerRequestId: result.metadata.correlationId ?? result.metadata.requestId, providerStatus: observed?.status, errorCode: 'cancellation-ambiguous' })
      return { status: 'unknown' as const }
    },
  }
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}

export function createPostgresGivingCancellationStore(pool: Pool): GivingCancellationStore {
  return {
    issueNonce(input) {
      return transaction(pool, async (client) => {
        const schedule = await client.query('SELECT status FROM giving_schedules WHERE id=$1 FOR UPDATE', [input.scheduleId])
        if (schedule.rows[0]?.status !== 'active') throw new GivingCancellationError('not-active')
        await client.query('UPDATE giving_cancellation_nonces SET consumed_at=$3 WHERE actor_id=$1 AND schedule_id=$2 AND consumed_at IS NULL', [input.actorId,input.scheduleId,input.now])
        await client.query('INSERT INTO giving_cancellation_nonces(token_digest,actor_id,schedule_id,reason_digest,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6)', [input.tokenDigest,input.actorId,input.scheduleId,input.reasonDigest,input.expiresAt,input.now])
      })
    },
    begin(input) {
      return transaction(pool, async (client) => {
        const nonce = await client.query(`UPDATE giving_cancellation_nonces SET consumed_at=$5 WHERE token_digest=$1 AND actor_id=$2 AND schedule_id=$3 AND reason_digest=$4 AND consumed_at IS NULL AND expires_at>$5 RETURNING id`, [input.tokenDigest,input.actorId,input.scheduleId,input.reasonDigest,input.now])
        if (nonce.rowCount !== 1) throw new GivingCancellationError('confirmation-invalid')
        const result = await client.query(`SELECT s.id schedule_id,s.checkout_id,s.environment,s.provider_schedule_id,s.status,c.context_key,c.synthetic,c.correlation_key FROM giving_schedules s JOIN giving_checkouts c ON c.id=s.checkout_id AND c.context_key=s.context_key WHERE s.id=$1 FOR UPDATE OF s,c`, [input.scheduleId])
        const row = result.rows[0]
        if (!row || row.status !== 'active') throw new GivingCancellationError('not-active')
        const version = Number((await client.query("SELECT COALESCE(MAX(logical_version),0)+1 value FROM giving_provider_operations WHERE checkout_id=$1 AND provider='blinkpay' AND action='blinkpay.cancel-schedule'", [row.checkout_id])).rows[0].value)
        const requestDigest = digest('giving-cancel-request-v1', `${input.actorId}\0${input.scheduleId}\0${input.reason}`)
        const operation = await client.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,schedule_id,actor_id,reason,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status) VALUES($1,$2,$3,$4,$5,$6,$7,'blinkpay','blinkpay.cancel-schedule',$8,$9,$10,$11,$12,'prepared') RETURNING id`, [row.context_key,row.environment,row.synthetic,row.checkout_id,input.scheduleId,input.actorId,input.reason,version,requestDigest,`${row.correlation_key}:cancel:${version}`,input.requestId,input.idempotencyKey])
        await client.query("UPDATE giving_provider_operations SET status='submitted',updated_at=$2 WHERE id=$1 AND status='prepared'", [operation.rows[0].id,input.now])
        await client.query(`INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome) VALUES($1,1,'submitted')`, [operation.rows[0].id])
        const transitioned = await client.query("UPDATE giving_schedules SET status='cancel_pending',updated_at=$2 WHERE id=$1 AND status='active'", [input.scheduleId,input.now])
        if (transitioned.rowCount !== 1) throw new GivingCancellationError('conflict')
        return { scheduleId:input.scheduleId,checkoutId:Number(row.checkout_id),environment:row.environment as GivingEnvironment,providerScheduleId:String(row.provider_schedule_id),actorId:input.actorId,reason:input.reason,operationId:Number(operation.rows[0].id),keys:{ requestId:input.requestId,idempotencyKey:input.idempotencyKey } }
      })
    },
    finish(input) {
      return transaction(pool, async (client) => {
        const operation = (await client.query(`SELECT id,status,schedule_id FROM giving_provider_operations WHERE id=$1 AND action='blinkpay.cancel-schedule' FOR UPDATE`, [input.target.operationId])).rows[0]
        const schedule = (await client.query('SELECT id,status FROM giving_schedules WHERE id=$1 FOR UPDATE', [input.target.scheduleId])).rows[0]
        if (!operation || Number(operation.schedule_id) !== input.target.scheduleId || !schedule) throw new GivingCancellationError('conflict')
        if (operation.status === 'succeeded' && schedule.status === 'cancelled') return
        if (!['submitted','unknown'].includes(String(operation.status)) || !['cancel_pending','unknown','cancelled'].includes(String(schedule.status))) throw new GivingCancellationError('conflict')
        const cancelled = input.outcome === 'cancelled' || schedule.status === 'cancelled'
        const operationStatus = cancelled ? 'succeeded' : input.outcome === 'unknown' ? 'unknown' : 'failed'
        const scheduleStatus = cancelled ? 'cancelled' : input.outcome === 'unknown' ? 'unknown' : 'active'
        await client.query(`UPDATE giving_provider_operations SET status=$2::varchar,provider_request_id=COALESCE($3,provider_request_id),updated_at=$4 WHERE id=$1`, [input.target.operationId,operationStatus,input.providerRequestId ?? null,input.now])
        await client.query(`INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id,error_code) SELECT $1,COALESCE(MAX(attempt_number),0)+1,$2,$3,$4 FROM giving_provider_operation_attempts WHERE operation_id=$1`, [input.target.operationId,operationStatus,input.providerRequestId ?? null,input.errorCode ?? null])
        await client.query(`UPDATE giving_schedules SET status=$2,provider_status=COALESCE($3,provider_status),provider_verified_at=$4,provider_source='cancellation',provider_observed_at=$4,provider_request_id=COALESCE($5,provider_request_id),updated_at=$4 WHERE id=$1`, [input.target.scheduleId,scheduleStatus,input.providerStatus ?? null,input.now,input.providerRequestId ?? null])
      })
    },
  }
}
