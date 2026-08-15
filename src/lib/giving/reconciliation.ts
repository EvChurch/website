import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { GivingEnvironment } from './contracts'
import type { BlinkPayConsent, BlinkPayFixedRecurringPayment, BlinkPayPayment } from './blinkpay/types'
import type { GivingCheckoutRecord } from './service'

const LEASE_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 8

export type LifecycleReferenceType = 'payment' | 'schedule' | 'consent'
export interface ClaimedLifecycleEvent { id: number; leaseToken: string; referenceType: LifecycleReferenceType; referenceId: string; environment: GivingEnvironment }
export interface AuthoritativeObservation {
  referenceType: LifecycleReferenceType
  referenceId: string
  providerStatus: string
  statusUpdatedAt: Date
  verifiedAt: Date
  providerRequestId?: string
}

const TERMINAL_STATUSES: Record<LifecycleReferenceType, readonly string[]> = {
  payment: ['settled', 'cancelled', 'failed'],
  schedule: ['cancelled', 'failed'],
  consent: ['revoked', 'expired', 'failed'],
}

function aggregateStatus(referenceType: LifecycleReferenceType, providerStatus: string): string {
  if (referenceType === 'payment') {
    if (providerStatus === 'AcceptedSettlementCompleted') return 'settled'
    if (/cancel/iu.test(providerStatus)) return 'cancelled'
    if (/fail|reject/iu.test(providerStatus)) return 'failed'
    return 'pending'
  }
  if (referenceType === 'schedule') {
    if (/cancel/iu.test(providerStatus)) return 'cancelled'
    if (/fail/iu.test(providerStatus)) return 'failed'
    return providerStatus.toLowerCase() === 'active' ? 'active' : 'unknown'
  }
  if (/revok/iu.test(providerStatus)) return 'revoked'
  if (/expir/iu.test(providerStatus)) return 'expired'
  if (/fail|reject/iu.test(providerStatus)) return 'failed'
  return providerStatus.toLowerCase() === 'authorised' ? 'authorised' : 'pending'
}

export interface GivingLifecycleStore {
  claim(eventId: number, now: Date): Promise<ClaimedLifecycleEvent | null>
  finalize(input: { eventId: number; leaseToken: string; observation: AuthoritativeObservation }): Promise<boolean>
  retry(eventId: number, leaseToken: string, now: Date, errorCode: string): Promise<boolean>
}

export interface LifecycleProvider {
  getPayment(id: string): Promise<BlinkPayPayment>
  getFixedRecurringPayment(id: string): Promise<BlinkPayFixedRecurringPayment>
  getEnduringConsent(id: string): Promise<BlinkPayConsent>
}

function observed(value: { status: string; status_updated_timestamp?: string; provider_correlation_id?: string }, referenceType: LifecycleReferenceType, referenceId: string, now: Date): AuthoritativeObservation {
  const timestamp = value.status_updated_timestamp ? new Date(value.status_updated_timestamp) : now
  if (Number.isNaN(timestamp.getTime())) throw new Error('Provider observation timestamp is invalid')
  return { referenceType, referenceId, providerStatus: value.status, statusUpdatedAt: timestamp, verifiedAt: now, ...(value.provider_correlation_id ? { providerRequestId: value.provider_correlation_id } : {}) }
}

export function createGivingLifecycleProcessor(dependencies: { store: GivingLifecycleStore; provider(environment: GivingEnvironment): LifecycleProvider; now?: () => Date }) {
  const now = dependencies.now ?? (() => new Date())
  return {
    async process(eventId: number): Promise<{ status: 'skipped' | 'processed' | 'retry' }> {
      const claimed = await dependencies.store.claim(eventId, now())
      if (!claimed) return { status: 'skipped' }
      try {
        const provider = dependencies.provider(claimed.environment)
        const value = claimed.referenceType === 'payment'
          ? await provider.getPayment(claimed.referenceId)
          : claimed.referenceType === 'schedule'
            ? await provider.getFixedRecurringPayment(claimed.referenceId)
            : await provider.getEnduringConsent(claimed.referenceId)
        const finalized = await dependencies.store.finalize({ eventId: claimed.id, leaseToken: claimed.leaseToken, observation: observed(value, claimed.referenceType, claimed.referenceId, now()) })
        return { status: finalized ? 'processed' : 'skipped' }
      } catch {
        await dependencies.store.retry(claimed.id, claimed.leaseToken, now(), 'provider-read-failed')
        return { status: 'retry' }
      }
    },
  }
}

export interface GivingReconciliationStore {
  recoverableEventIds(now: Date, limit?: number): Promise<number[]>
  nonterminalCheckoutIdsWithProviderIds(limit?: number): Promise<number[]>
  authorisedConsentsWithoutSchedule(limit?: number): Promise<Array<{ checkout: GivingCheckoutRecord; providerConsentId: string }>>
  unknownCancellationOperations(limit?: number): Promise<UnknownCancellationOperation[]>
  recordCancellationObservation(input: { operationId: number; scheduleId: number; providerStatus: string; providerRequestId?: string; observedAt: Date; cancelled: boolean }): Promise<boolean>
}

export interface UnknownCancellationOperation { operationId: number; scheduleId: number; environment: GivingEnvironment; providerScheduleId: string }

export function createUnknownCancellationReconciler(dependencies: { store: GivingReconciliationStore; provider(environment: GivingEnvironment): LifecycleProvider; now?: () => Date }) {
  return async (candidate: UnknownCancellationOperation) => {
    const schedule = await dependencies.provider(candidate.environment).getFixedRecurringPayment(candidate.providerScheduleId)
    return dependencies.store.recordCancellationObservation({
      operationId: candidate.operationId,
      scheduleId: candidate.scheduleId,
      providerStatus: schedule.status,
      ...(schedule.provider_correlation_id ? { providerRequestId: schedule.provider_correlation_id } : {}),
      observedAt: (dependencies.now ?? (() => new Date()))(),
      cancelled: /cancel/iu.test(schedule.status),
    })
  }
}

export async function runGivingReconciliation(dependencies: { store: GivingReconciliationStore; processEvent(id: number): Promise<unknown>; verifyCheckout(checkoutId: number): Promise<void>; continueRecurringCheckout(checkout: GivingCheckoutRecord, providerConsentId: string): Promise<void>; reconcileCancellation(candidate: UnknownCancellationOperation): Promise<unknown>; now?: () => Date }) {
  const ids = await dependencies.store.recoverableEventIds((dependencies.now ?? (() => new Date()))())
  let eventFailures = 0
  for (const id of ids) {
    try { await dependencies.processEvent(id) }
    catch { eventFailures += 1 }
  }
  const checkoutIds = await dependencies.store.nonterminalCheckoutIdsWithProviderIds()
  let verificationFailures = 0
  for (const checkoutId of checkoutIds) {
    try { await dependencies.verifyCheckout(checkoutId) }
    catch { verificationFailures += 1 }
  }
  const continuations = await dependencies.store.authorisedConsentsWithoutSchedule()
  let continuationFailures = 0
  for (const candidate of continuations) {
    try { await dependencies.continueRecurringCheckout(candidate.checkout, candidate.providerConsentId) }
    catch { continuationFailures += 1 }
  }
  const cancellations = await dependencies.store.unknownCancellationOperations()
  let cancellationFailures = 0
  for (const candidate of cancellations) {
    try { await dependencies.reconcileCancellation(candidate) }
    catch { cancellationFailures += 1 }
  }
  return {
    events: ids.length,
    eventFailures,
    verifications: checkoutIds.length,
    verificationFailures,
    continuations: continuations.length,
    continuationFailures,
    cancellations: cancellations.length,
    cancellationFailures,
  }
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}

function checkoutFromRow(row: Record<string, unknown>): GivingCheckoutRecord {
  return {
    id: Number(row.checkout_id), contextKey: String(row.context_key), environment: row.environment as GivingEnvironment,
    synthetic: Boolean(row.synthetic), e2eRunId: row.e2e_run_id === null ? null : Number(row.e2e_run_id), giverId: Number(row.giver_id),
    bankReference: String(row.bank_reference), fundId: Number(row.fund_id), fundName: String(row.fund_name), fundCode: String(row.fund_code),
    fundAccountingKey: String(row.fund_accounting_key), amountMinor: Number(row.amount_minor), frequency: row.frequency as GivingCheckoutRecord['frequency'],
    firstPaymentDate: row.first_payment_date ? String(row.first_payment_date).slice(0, 10) : null, correlationKey: String(row.correlation_key),
    submissionKeyDigest: String(row.submission_key_digest), submissionDigest: String(row.submission_digest), gatewayRedirectUri: row.gateway_redirect_uri ? String(row.gateway_redirect_uri) : null,
    status: row.checkout_status as GivingCheckoutRecord['status'], resultCode: row.result_code as GivingCheckoutRecord['resultCode'],
  }
}

export function createPostgresGivingLifecycleStore(pool: Pool): GivingLifecycleStore & GivingReconciliationStore & {
  recordVerifiedEvent(input: { environment: GivingEnvironment; eventId: string; eventType: string; referenceType: LifecycleReferenceType; referenceId: string; payloadDigest: string; payload: Record<string, unknown>; now: Date }): Promise<{ outcome: 'inserted' | 'duplicate' | 'conflict' | 'quarantined'; eventId: number }>
} {
  return {
    recordVerifiedEvent(input) {
      return transaction(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${input.environment}:${input.eventId}`])
        const existing = (await client.query('SELECT id,payload_digest FROM blinkpay_webhook_events WHERE environment=$1 AND provider_event_id=$2 FOR UPDATE', [input.environment, input.eventId])).rows[0]
        if (existing) {
          if (existing.payload_digest === input.payloadDigest) {
            await client.query('UPDATE blinkpay_webhook_events SET duplicate_count=duplicate_count+1,last_duplicate_at=$3,updated_at=$3 WHERE environment=$1 AND provider_event_id=$2', [input.environment,input.eventId,input.now])
            return { outcome: 'duplicate', eventId: Number(existing.id) }
          }
          await client.query("UPDATE blinkpay_webhook_events SET status='quarantined',conflict_count=conflict_count+1,last_conflict_at=$3,last_conflicting_digest=$4,lease_token=NULL,lease_expires_at=NULL,updated_at=$3 WHERE environment=$1 AND provider_event_id=$2", [input.environment,input.eventId,input.now,input.payloadDigest])
          return { outcome: 'conflict', eventId: Number(existing.id) }
        }
        const table = input.referenceType === 'payment' ? 'giving_gifts' : input.referenceType === 'schedule' ? 'giving_schedules' : 'giving_consents'
        const column = input.referenceType === 'payment' ? 'provider_payment_id' : input.referenceType === 'schedule' ? 'provider_schedule_id' : 'provider_consent_id'
        const matched = (await client.query(`SELECT context_key,synthetic,e2e_run_id FROM ${table} WHERE environment=$1 AND ${column}=$2`, [input.environment,input.referenceId])).rows[0]
        const status = matched ? 'pending' : 'quarantined'
        const contextKey = matched?.context_key ?? `${input.environment}:unmatched`
        const inserted = await client.query(`INSERT INTO blinkpay_webhook_events(context_key,environment,synthetic,e2e_run_id,provider_event_id,event_type,provider_reference_type,provider_reference_id,payload_digest,payload,status,next_attempt_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [contextKey,input.environment,matched ? matched.synthetic : input.environment === 'sandbox',matched?.e2e_run_id ?? null,input.eventId,input.eventType,input.referenceType,input.referenceId,input.payloadDigest,input.payload,status,matched ? input.now : null])
        return { outcome: matched ? 'inserted' : 'quarantined', eventId: Number(inserted.rows[0].id) }
      })
    },
    async claim(eventId, now) {
      const leaseToken = randomUUID()
      const result = await pool.query(`UPDATE blinkpay_webhook_events SET status='processing',lease_token=$2,lease_expires_at=$3,attempt_count=attempt_count+1,next_attempt_at=NULL,last_error=NULL,updated_at=$4
        WHERE id=$1 AND attempt_count<$5 AND ((status IN ('pending','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=$4)) OR (status='processing' AND lease_expires_at<=$4))
        RETURNING id,lease_token,provider_reference_type,provider_reference_id,environment`, [eventId,leaseToken,new Date(now.getTime()+LEASE_MS),now,MAX_ATTEMPTS])
      const row = result.rows[0]
      return row ? { id:Number(row.id), leaseToken:String(row.lease_token), referenceType:row.provider_reference_type as LifecycleReferenceType, referenceId:String(row.provider_reference_id), environment:row.environment as GivingEnvironment } : null
    },
    finalize(input) {
      return transaction(pool, async (client) => {
        const event = (await client.query(`
          SELECT id, environment, provider_reference_type, provider_reference_id
          FROM blinkpay_webhook_events
          WHERE id = $1
            AND status = 'processing'
            AND lease_token = $2
          FOR UPDATE
        `, [input.eventId, input.leaseToken])).rows[0]
        if (!event) return false

        const o = input.observation
        if (event.provider_reference_type !== o.referenceType || event.provider_reference_id !== o.referenceId) {
          throw new Error('Webhook observation does not match its claimed reference')
        }

        const target = o.referenceType === 'payment'
          ? { table: 'giving_gifts', providerColumn: 'provider_payment_id' }
          : o.referenceType === 'schedule'
            ? { table: 'giving_schedules', providerColumn: 'provider_schedule_id' }
            : { table: 'giving_consents', providerColumn: 'provider_consent_id' }

        const aggregate = (await client.query(`
          SELECT id, status, provider_status, provider_status_updated_at
          FROM ${target.table}
          WHERE environment = $1
            AND ${target.providerColumn} = $2
          FOR UPDATE
        `, [event.environment, o.referenceId])).rows[0]
        if (!aggregate) throw new Error(`Webhook ${o.referenceType} correlation is stale`)

        const currentTimestamp = aggregate.provider_status_updated_at
          ? new Date(aggregate.provider_status_updated_at).getTime()
          : null
        const incomingTimestamp = o.statusUpdatedAt.getTime()

        if (currentTimestamp === incomingTimestamp && aggregate.provider_status !== o.providerStatus) {
          const quarantined = await client.query(`
            UPDATE blinkpay_webhook_events
            SET status = 'quarantined', conflict_count = conflict_count + 1,
                last_conflict_at = $3, last_error = 'provider-observation-conflict',
                lease_token = NULL, lease_expires_at = NULL, updated_at = $3
            WHERE id = $1 AND lease_token = $2
            RETURNING id
          `, [input.eventId, input.leaseToken, o.verifiedAt])
          return quarantined.rowCount === 1
        }

        if (currentTimestamp === null || incomingTimestamp > currentTimestamp) {
          const proposedStatus = aggregateStatus(o.referenceType, o.providerStatus)
          const localStatus = TERMINAL_STATUSES[o.referenceType].includes(String(aggregate.status))
            ? String(aggregate.status)
            : proposedStatus
          await client.query(`
            UPDATE ${target.table}
            SET status = $3, provider_status = $4,
                provider_status_updated_at = $5, provider_verified_at = $6,
                provider_source = 'webhook',
                provider_request_id = COALESCE($7, provider_request_id),
                provider_observed_at = $5, updated_at = $6
            WHERE environment = $1
              AND ${target.providerColumn} = $2
          `, [event.environment, o.referenceId, localStatus, o.providerStatus, o.statusUpdatedAt, o.verifiedAt, o.providerRequestId ?? null])
        }

        const completed = await client.query(`
          UPDATE blinkpay_webhook_events
          SET status = 'processed', processed_at = $3,
              lease_token = NULL, lease_expires_at = NULL,
              last_error = NULL, updated_at = $3
          WHERE id = $1 AND lease_token = $2
          RETURNING id
        `, [input.eventId, input.leaseToken, o.verifiedAt])
        return completed.rowCount === 1
      })
    },
    async retry(eventId, leaseToken, now, errorCode) {
      const result = await pool.query(`UPDATE blinkpay_webhook_events SET status=CASE WHEN attempt_count>=$4 THEN 'dead' ELSE 'retry' END,next_attempt_at=CASE WHEN attempt_count>=$4 THEN NULL ELSE $3 + make_interval(secs => LEAST(3600,30*power(2,attempt_count-1))::integer) END,lease_token=NULL,lease_expires_at=NULL,last_error=$5,updated_at=$3 WHERE id=$1 AND status='processing' AND lease_token=$2 RETURNING id`, [eventId,leaseToken,now,MAX_ATTEMPTS,errorCode])
      return result.rowCount === 1
    },
    async recoverableEventIds(now, limit = 100) {
      await pool.query(`
        UPDATE blinkpay_webhook_events
        SET status = 'dead', lease_token = NULL, lease_expires_at = NULL,
            next_attempt_at = NULL, last_error = 'attempts-exhausted', updated_at = $1
        WHERE status = 'processing'
          AND lease_expires_at <= $1
          AND attempt_count >= $2
      `, [now, MAX_ATTEMPTS])
      const result = await pool.query(`
        SELECT id
        FROM blinkpay_webhook_events
        WHERE (
          status IN ('pending', 'retry')
          AND (next_attempt_at IS NULL OR next_attempt_at <= $1)
        ) OR (
          status = 'processing'
          AND lease_expires_at <= $1
          AND attempt_count < $2
        )
        ORDER BY created_at
        LIMIT $3
      `, [now, MAX_ATTEMPTS, limit])
      return result.rows.map((row) => Number(row.id))
    },
    async nonterminalCheckoutIdsWithProviderIds(limit = 100) {
      const result = await pool.query(`
        SELECT DISTINCT checkout.id
        FROM giving_checkouts checkout
        JOIN giving_provider_operations operation
          ON operation.checkout_id = checkout.id
         AND operation.context_key = checkout.context_key
        WHERE checkout.status NOT IN ('completed', 'failed')
          AND operation.provider = 'blinkpay'
          AND operation.action IN ('blinkpay.create-payment', 'blinkpay.create-consent')
          AND operation.provider_id IS NOT NULL
          AND operation.status IN ('succeeded','unknown')
        ORDER BY checkout.id
        LIMIT $1
      `, [limit])
      return result.rows.map((row) => Number(row.id))
    },
    async authorisedConsentsWithoutSchedule(limit = 100) {
      const result = await pool.query(`SELECT c.provider_consent_id,co.id checkout_id,co.context_key,co.environment,co.synthetic,co.e2e_run_id,co.giver_id,g.bank_reference,co.fund_id,co.fund_name,co.fund_code,co.fund_accounting_key,co.amount_minor,co.frequency,co.first_payment_date,co.correlation_key,co.submission_key_digest,co.submission_digest,co.gateway_redirect_uri,co.status checkout_status,co.result_code
        FROM giving_consents c JOIN giving_checkouts co ON co.id=c.checkout_id AND co.context_key=c.context_key JOIN giving_givers g ON g.id=co.giver_id AND g.context_key=co.context_key LEFT JOIN giving_schedules s ON s.consent_id=c.id WHERE c.status='authorised' AND s.id IS NULL ORDER BY c.updated_at LIMIT $1`, [limit])
      return result.rows.map((row) => ({ checkout: checkoutFromRow(row), providerConsentId: String(row.provider_consent_id) }))
    },
    async unknownCancellationOperations(limit = 100) {
      const result = await pool.query(`SELECT operation.id operation_id,schedule.id schedule_id,schedule.environment,schedule.provider_schedule_id
        FROM giving_provider_operations operation
        JOIN giving_schedules schedule ON schedule.id=operation.schedule_id AND schedule.context_key=operation.context_key
        WHERE operation.provider='blinkpay' AND operation.action='blinkpay.cancel-schedule'
          AND operation.status IN ('submitted','unknown') AND schedule.status IN ('cancel_pending','unknown')
        ORDER BY operation.updated_at,operation.id LIMIT $1`, [limit])
      return result.rows.map((row) => ({ operationId:Number(row.operation_id),scheduleId:Number(row.schedule_id),environment:row.environment as GivingEnvironment,providerScheduleId:String(row.provider_schedule_id) }))
    },
    recordCancellationObservation(input) {
      return transaction(pool, async (client) => {
        const operation = (await client.query(`SELECT id,status,schedule_id FROM giving_provider_operations WHERE id=$1 AND action='blinkpay.cancel-schedule' AND status IN ('submitted','unknown') FOR UPDATE`,[input.operationId])).rows[0]
        if (!operation || Number(operation.schedule_id) !== input.scheduleId) return false
        const schedule = (await client.query(`SELECT id,status FROM giving_schedules WHERE id=$1 AND status IN ('cancel_pending','unknown') FOR UPDATE`,[input.scheduleId])).rows[0]
        if (!schedule) return false
        const operationStatus = input.cancelled ? 'succeeded' : 'unknown'
        const scheduleStatus = input.cancelled ? 'cancelled' : 'unknown'
        await client.query('UPDATE giving_provider_operations SET status=$2,provider_request_id=COALESCE($3,provider_request_id),updated_at=$4 WHERE id=$1',[input.operationId,operationStatus,input.providerRequestId ?? null,input.observedAt])
        await client.query(`INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id,error_code) SELECT $1,COALESCE(MAX(attempt_number),0)+1,$2,$3,$4 FROM giving_provider_operation_attempts WHERE operation_id=$1`,[input.operationId,operationStatus,input.providerRequestId ?? null,input.cancelled ? null : 'cancellation-still-unknown'])
        await client.query(`UPDATE giving_schedules SET status=$2,provider_status=$3,provider_verified_at=$4,provider_source='reconciliation',provider_observed_at=$4,provider_request_id=COALESCE($5,provider_request_id),updated_at=$4 WHERE id=$1`,[input.scheduleId,scheduleStatus,input.providerStatus,input.observedAt,input.providerRequestId ?? null])
        return true
      })
    },
  }
}
