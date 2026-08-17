import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { GivingEnvironment } from './contracts'
import type { BlinkPayConsent, BlinkPayFixedRecurringPayment, BlinkPayPayment } from './blinkpay/types'
import type { GivingCheckoutRecord } from './service'

const LEASE_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 8
const RECONCILIATION_CONCURRENCY = 4

export type LifecycleReferenceType = 'payment' | 'schedule' | 'consent'
export interface ClaimedLifecycleEvent { id: number; leaseToken: string; referenceType: LifecycleReferenceType; referenceId: string; environment: GivingEnvironment }
export interface AuthoritativeObservation {
  referenceType: LifecycleReferenceType
  referenceId: string
  providerStatus: string
  statusUpdatedAt: Date
  verifiedAt: Date
  providerRequestId?: string
  paymentConsentId?: string | null
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

export class GivingLifecycleCorrelationPendingError extends Error {
  constructor() {
    super('Recurring payment correlation is not locally available yet')
    this.name = 'GivingLifecycleCorrelationPendingError'
  }
}

const PROVIDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function observed(value: { status: string; status_updated_timestamp?: string; provider_correlation_id?: string; detail?: Record<string, unknown> }, referenceType: LifecycleReferenceType, referenceId: string, now: Date): AuthoritativeObservation {
  const timestamp = value.status_updated_timestamp ? new Date(value.status_updated_timestamp) : now
  if (Number.isNaN(timestamp.getTime())) throw new Error('Provider observation timestamp is invalid')
  const paymentConsentId = referenceType === 'payment'
    ? (typeof value.detail?.consent_id === 'string' && PROVIDER_ID_PATTERN.test(value.detail.consent_id) ? value.detail.consent_id : null)
    : undefined
  return { referenceType, referenceId, providerStatus: value.status, statusUpdatedAt: timestamp, verifiedAt: now, ...(value.provider_correlation_id ? { providerRequestId: value.provider_correlation_id } : {}), ...(referenceType === 'payment' ? { paymentConsentId } : {}) }
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
      } catch (error) {
        const errorCode = error instanceof GivingLifecycleCorrelationPendingError ? 'payment-correlation-pending' : 'provider-read-failed'
        await dependencies.store.retry(claimed.id, claimed.leaseToken, now(), errorCode)
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

async function runBounded<T>(items: readonly T[], work: (item: T) => Promise<unknown>) {
  let cursor = 0
  let failures = 0
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!
      try { await work(item) }
      catch { failures += 1 }
    }
  }
  await Promise.all(Array.from({ length: Math.min(RECONCILIATION_CONCURRENCY,items.length) }, worker))
  return failures
}

export async function runGivingReconciliation(dependencies: { store: GivingReconciliationStore; processEvent(id: number): Promise<unknown>; verifyCheckout(checkoutId: number): Promise<void>; continueRecurringCheckout(checkout: GivingCheckoutRecord, providerConsentId: string): Promise<void>; reconcileCancellation(candidate: UnknownCancellationOperation): Promise<unknown>; now?: () => Date }) {
  const ids = await dependencies.store.recoverableEventIds((dependencies.now ?? (() => new Date()))())
  const eventFailures = await runBounded(ids, dependencies.processEvent)
  const checkoutIds = await dependencies.store.nonterminalCheckoutIdsWithProviderIds()
  const verificationFailures = await runBounded(checkoutIds, dependencies.verifyCheckout)
  const continuations = await dependencies.store.authorisedConsentsWithoutSchedule()
  const continuationFailures = await runBounded(continuations, (candidate) => dependencies.continueRecurringCheckout(candidate.checkout,candidate.providerConsentId))
  const cancellations = await dependencies.store.unknownCancellationOperations()
  const cancellationFailures = await runBounded(cancellations, dependencies.reconcileCancellation)
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
  const firstPaymentDate = row.first_payment_date instanceof Date
    ? `${row.first_payment_date.getFullYear()}-${String(row.first_payment_date.getMonth()+1).padStart(2,'0')}-${String(row.first_payment_date.getDate()).padStart(2,'0')}`
    : row.first_payment_date ? String(row.first_payment_date).slice(0,10) : null
  return {
    id: Number(row.checkout_id), contextKey: String(row.context_key), environment: row.environment as GivingEnvironment,
    synthetic: Boolean(row.synthetic), e2eRunId: row.e2e_run_id === null ? null : Number(row.e2e_run_id), giverId: Number(row.giver_id),
    bankReference: String(row.bank_reference), bankCode: String(row.bank_code), fundId: Number(row.fund_id), fundName: String(row.fund_name), fundCode: String(row.fund_code),
    fundAccountingKey: String(row.fund_accounting_key), amountMinor: Number(row.amount_minor), frequency: row.frequency as GivingCheckoutRecord['frequency'],
    firstPaymentDate, correlationKey: String(row.correlation_key),
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
        const unresolvedRecurringPayment = input.referenceType === 'payment' && !matched
        const status = matched || unresolvedRecurringPayment ? 'pending' : 'quarantined'
        const contextKey = matched?.context_key ?? `${input.environment}:unmatched`
        const inserted = await client.query(`INSERT INTO blinkpay_webhook_events(context_key,environment,synthetic,e2e_run_id,provider_event_id,event_type,provider_reference_type,provider_reference_id,payload_digest,payload,status,next_attempt_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [contextKey,input.environment,matched ? matched.synthetic : input.environment === 'sandbox',matched?.e2e_run_id ?? null,input.eventId,input.eventType,input.referenceType,input.referenceId,input.payloadDigest,input.payload,status,matched || unresolvedRecurringPayment ? input.now : null])
        return { outcome: matched || unresolvedRecurringPayment ? 'inserted' : 'quarantined', eventId: Number(inserted.rows[0].id) }
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
          SELECT id, context_key, environment, provider_reference_type, provider_reference_id
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

        let aggregate = (await client.query(`
          SELECT id, status, provider_status, provider_status_updated_at
          FROM ${target.table}
          WHERE environment = $1
            AND ${target.providerColumn} = $2
          FOR UPDATE
        `, [event.environment, o.referenceId])).rows[0]

        const quarantine = async (errorCode: string) => {
          const result = await client.query(`UPDATE blinkpay_webhook_events
            SET status='quarantined',last_error=$3,lease_token=NULL,lease_expires_at=NULL,updated_at=$4
            WHERE id=$1 AND lease_token=$2 RETURNING id`, [input.eventId,input.leaseToken,errorCode,o.verifiedAt])
          return result.rowCount === 1
        }

        if (!aggregate && o.referenceType === 'payment') {
          if (!o.paymentConsentId) return quarantine('payment-consent-invalid')
          const consent = (await client.query(`
            SELECT consent.id,
                   checkout.id checkout_id
            FROM giving_consents consent
            LEFT JOIN giving_checkouts checkout
              ON checkout.id=consent.checkout_id
             AND checkout.context_key=consent.context_key
             AND checkout.environment=consent.environment
             AND checkout.giver_id=consent.giver_id
             AND checkout.synthetic=consent.synthetic
             AND checkout.e2e_run_id IS NOT DISTINCT FROM consent.e2e_run_id
            WHERE consent.environment=$1 AND consent.provider_consent_id=$2
            FOR UPDATE OF consent
          `, [event.environment,o.paymentConsentId])).rows[0]
          if (!consent) {
            const crossEnvironment = (await client.query(`SELECT 1 FROM giving_consents
              WHERE provider_consent_id=$1 AND environment<>$2 LIMIT 1`, [o.paymentConsentId,event.environment])).rowCount === 1
            if (crossEnvironment) return quarantine('payment-consent-cross-environment')
            throw new GivingLifecycleCorrelationPendingError()
          }
          if (!consent.checkout_id) return quarantine('payment-consent-context-conflict')
          const provenance = (await client.query(`
            SELECT consent.id consent_id, schedule.id schedule_id,
                   checkout.id checkout_id, checkout.context_key, checkout.environment,
                   checkout.synthetic, checkout.e2e_run_id, checkout.giver_id,
                   checkout.fund_id, checkout.fund_name, checkout.fund_code,
                   checkout.fund_accounting_key, schedule.amount_minor schedule_amount_minor
            FROM giving_consents consent
            JOIN giving_schedules schedule
              ON schedule.consent_id=consent.id AND schedule.context_key=consent.context_key
            JOIN giving_checkouts checkout
              ON checkout.id=schedule.checkout_id AND checkout.context_key=schedule.context_key
            WHERE consent.environment=$1 AND consent.provider_consent_id=$2
              AND schedule.environment=consent.environment
              AND checkout.environment=consent.environment
              AND schedule.giver_id=consent.giver_id
              AND checkout.giver_id=consent.giver_id
              AND schedule.synthetic=consent.synthetic
              AND checkout.synthetic=consent.synthetic
              AND schedule.e2e_run_id IS NOT DISTINCT FROM consent.e2e_run_id
              AND checkout.e2e_run_id IS NOT DISTINCT FROM consent.e2e_run_id
              AND schedule.amount_minor=checkout.amount_minor
            FOR UPDATE OF consent,schedule,checkout
          `, [event.environment,o.paymentConsentId])).rows[0]
          if (!provenance) {
            const scheduleExists = (await client.query('SELECT 1 FROM giving_schedules WHERE consent_id=$1 LIMIT 1', [consent.id])).rowCount === 1
            if (scheduleExists) return quarantine('payment-consent-context-conflict')
            throw new GivingLifecycleCorrelationPendingError()
          }
          await client.query(`INSERT INTO giving_gifts(
              context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,consent_id,schedule_id,
              fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,provider_payment_id,status)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
            ON CONFLICT(environment,provider_payment_id) DO NOTHING`, [
            provenance.context_key,provenance.environment,provenance.synthetic,provenance.e2e_run_id,
            provenance.checkout_id,provenance.giver_id,provenance.consent_id,provenance.schedule_id,
            provenance.fund_id,provenance.fund_name,provenance.fund_code,provenance.fund_accounting_key,
            provenance.schedule_amount_minor,o.referenceId,
          ])
          aggregate = (await client.query(`SELECT id,status,provider_status,provider_status_updated_at,
              context_key,synthetic,e2e_run_id,consent_id,schedule_id
            FROM giving_gifts WHERE environment=$1 AND provider_payment_id=$2 FOR UPDATE`, [event.environment,o.referenceId])).rows[0]
          if (!aggregate || Number(aggregate.consent_id) !== Number(provenance.consent_id) || Number(aggregate.schedule_id) !== Number(provenance.schedule_id) || aggregate.context_key !== provenance.context_key) {
            return quarantine('payment-correlation-conflict')
          }
          await client.query(`UPDATE blinkpay_webhook_events SET context_key=$3,synthetic=$4,e2e_run_id=$5,updated_at=$6
            WHERE id=$1 AND lease_token=$2`, [input.eventId,input.leaseToken,provenance.context_key,provenance.synthetic,provenance.e2e_run_id,o.verifiedAt])
        }
        if (!aggregate) throw new Error(`Webhook ${o.referenceType} correlation is stale`)

        if (o.referenceType === 'payment' && event.context_key === `${event.environment}:unmatched`) {
          const provenance = (await client.query(`SELECT gift.context_key,gift.synthetic,gift.e2e_run_id,consent.provider_consent_id
            FROM giving_gifts gift
            JOIN giving_consents consent ON consent.id=gift.consent_id AND consent.context_key=gift.context_key
            WHERE gift.id=$1`, [aggregate.id])).rows[0]
          if (!provenance || provenance.provider_consent_id !== o.paymentConsentId) return quarantine('payment-correlation-conflict')
          await client.query(`UPDATE blinkpay_webhook_events SET context_key=$3,synthetic=$4,e2e_run_id=$5,updated_at=$6
            WHERE id=$1 AND lease_token=$2`, [input.eventId,input.leaseToken,provenance.context_key,provenance.synthetic,provenance.e2e_run_id,o.verifiedAt])
        }

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

        if (o.referenceType === 'schedule') {
          const current = await client.query('SELECT status FROM giving_schedules WHERE id=$1', [aggregate.id])
          if (current.rows[0]?.status === 'cancelled') {
            const hasCancellationLink = (await client.query(`SELECT EXISTS(
              SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='giving_provider_operations' AND column_name='schedule_id'
            ) present`)).rows[0]?.present
            if (hasCancellationLink) await client.query(`WITH transitioned AS (
                UPDATE giving_provider_operations
                SET status='succeeded',provider_request_id=COALESCE($2,provider_request_id),updated_at=$3
                WHERE schedule_id=$1 AND provider='blinkpay' AND action='blinkpay.cancel-schedule'
                  AND status IN ('submitted','unknown') RETURNING id
              ), attempts AS (
                SELECT transitioned.id operation_id,COALESCE(MAX(existing.attempt_number),0)+1 attempt_number
                FROM transitioned LEFT JOIN giving_provider_operation_attempts existing ON existing.operation_id=transitioned.id
                GROUP BY transitioned.id
              )
              INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id)
              SELECT operation_id,attempt_number,'succeeded',$2 FROM attempts`, [aggregate.id,o.providerRequestId ?? null,o.verifiedAt])
          }
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
      const result = await pool.query(`UPDATE blinkpay_webhook_events SET status=CASE WHEN attempt_count>=$4 THEN 'dead' ELSE 'retry' END,next_attempt_at=CASE WHEN attempt_count>=$4 THEN NULL ELSE $3::timestamptz + make_interval(secs => LEAST(3600,30*power(2,attempt_count-1))::integer) END,lease_token=NULL,lease_expires_at=NULL,last_error=$5,updated_at=$3 WHERE id=$1 AND status='processing' AND lease_token=$2 RETURNING id`, [eventId,leaseToken,now,MAX_ATTEMPTS,errorCode])
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
      const result = await pool.query(`SELECT c.provider_consent_id,co.id checkout_id,co.context_key,co.environment,co.synthetic,co.e2e_run_id,co.giver_id,g.bank_reference,co.bank_code,co.fund_id,co.fund_name,co.fund_code,co.fund_accounting_key,co.amount_minor,co.frequency,co.first_payment_date,co.correlation_key,co.submission_key_digest,co.submission_digest,co.gateway_redirect_uri,co.status checkout_status,co.result_code
        FROM giving_consents c JOIN giving_checkouts co ON co.id=c.checkout_id AND co.context_key=c.context_key JOIN giving_givers g ON g.id=co.giver_id AND g.context_key=co.context_key LEFT JOIN giving_schedules s ON s.consent_id=c.id WHERE c.status='authorised' AND s.id IS NULL ORDER BY c.updated_at LIMIT $1`, [limit])
      return result.rows.map((row) => ({ checkout: checkoutFromRow(row), providerConsentId: String(row.provider_consent_id) }))
    },
    async unknownCancellationOperations(limit = 100) {
      const result = await pool.query(`SELECT operation.id operation_id,schedule.id schedule_id,schedule.environment,schedule.provider_schedule_id
        FROM giving_provider_operations operation
        JOIN giving_schedules schedule ON schedule.id=operation.schedule_id AND schedule.context_key=operation.context_key
        WHERE operation.provider='blinkpay' AND operation.action='blinkpay.cancel-schedule'
          AND operation.status IN ('submitted','unknown') AND schedule.status IN ('cancel_pending','unknown','cancelled')
        ORDER BY operation.updated_at,operation.id LIMIT $1`, [limit])
      return result.rows.map((row) => ({ operationId:Number(row.operation_id),scheduleId:Number(row.schedule_id),environment:row.environment as GivingEnvironment,providerScheduleId:String(row.provider_schedule_id) }))
    },
    recordCancellationObservation(input) {
      return transaction(pool, async (client) => {
        const operation = (await client.query(`SELECT id,status,schedule_id FROM giving_provider_operations WHERE id=$1 AND action='blinkpay.cancel-schedule' AND status IN ('submitted','unknown') FOR UPDATE`,[input.operationId])).rows[0]
        if (!operation || Number(operation.schedule_id) !== input.scheduleId) return false
        const schedule = (await client.query(`SELECT id,status FROM giving_schedules WHERE id=$1 AND status IN ('cancel_pending','unknown','cancelled') FOR UPDATE`,[input.scheduleId])).rows[0]
        if (!schedule) return false
        const cancelled = input.cancelled || schedule.status === 'cancelled'
        const operationStatus = cancelled ? 'succeeded' : 'unknown'
        const scheduleStatus = cancelled ? 'cancelled' : 'unknown'
        await client.query('UPDATE giving_provider_operations SET status=$2,provider_request_id=COALESCE($3,provider_request_id),updated_at=$4 WHERE id=$1',[input.operationId,operationStatus,input.providerRequestId ?? null,input.observedAt])
        await client.query(`INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id,error_code) SELECT $1,COALESCE(MAX(attempt_number),0)+1,$2,$3,$4 FROM giving_provider_operation_attempts WHERE operation_id=$1`,[input.operationId,operationStatus,input.providerRequestId ?? null,cancelled ? null : 'cancellation-still-unknown'])
        await client.query(`UPDATE giving_schedules SET status=$2,provider_status=$3,provider_verified_at=$4,provider_source='reconciliation',provider_observed_at=$4,provider_request_id=COALESCE($5,provider_request_id),updated_at=$4 WHERE id=$1`,[input.scheduleId,scheduleStatus,input.providerStatus,input.observedAt,input.providerRequestId ?? null])
        return true
      })
    },
  }
}
