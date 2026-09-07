import type { Pool } from 'pg'
import type { GivingEnvironment } from './contracts'
import type { BlinkPayFixedRecurringPayment, BlinkPayPayment } from './blinkpay/types'
import { minorUnitsToNzd, validateIsoTimestamp, validateNzDate } from './blinkpay/validation'
import type { LifecycleProvider } from './reconciliation'

interface RecurringCandidate {
  id: number
  environment: GivingEnvironment
  provider_schedule_id: string
  provider_consent_id: string
}

interface RecurringProvenance extends RecurringCandidate {
  context_key: string
  synthetic: boolean
  checkout_id: number
  giver_id: number
  consent_id: number
  fund_id: number
  fund_name: string
  fund_code: string
  fund_accounting_key: string
  bank_code: string
  bank_reference: string
  amount_minor: string
  transaction_fee_minor: string
}

function assertPaymentDetails(value: unknown, row: RecurringProvenance) {
  if (!value || typeof value !== 'object') throw new Error('Recurring payment details missing')
  const detail = value as Record<string, unknown>
  const amount = detail.amount as Record<string, unknown> | undefined
  const pcr = detail.pcr as Record<string, unknown> | undefined
  if (amount?.currency !== 'NZD' || amount.total !== minorUnitsToNzd(Number(row.amount_minor) + Number(row.transaction_fee_minor)) ||
    pcr?.particulars !== row.fund_code.slice(0, 12) || pcr.code !== row.bank_code || pcr.reference !== row.bank_reference) {
    throw new Error('Recurring payment amount or reference mismatch')
  }
}

function paymentStatus(status: string) {
  if (status === 'AcceptedSettlementCompleted') return 'settled'
  if (/cancel/iu.test(status)) return 'cancelled'
  if (/fail|reject/iu.test(status)) return 'failed'
  return 'pending'
}

/** Provider GET observations only. Never creates a payment or fabricates a webhook event. */
export async function recordRecurringObservation(pool: Pool, candidate: RecurringCandidate, schedule: BlinkPayFixedRecurringPayment, payments: BlinkPayPayment[], observedAt: Date) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const row = (await client.query<RecurringProvenance>(`
      SELECT s.id,s.environment,s.provider_schedule_id,c.provider_consent_id,s.context_key,s.synthetic,
             s.checkout_id,s.giver_id,s.consent_id,s.amount_minor,s.transaction_fee_minor,
             co.fund_id,co.fund_name,co.fund_code,co.fund_accounting_key,co.bank_code,g.bank_reference
      FROM giving_schedules s
      JOIN giving_consents c ON c.id=s.consent_id AND c.checkout_id=s.checkout_id
        AND c.environment=s.environment AND c.synthetic=s.synthetic AND c.context_key=s.context_key AND c.giver_id=s.giver_id
      JOIN giving_checkouts co ON co.id=s.checkout_id AND co.environment=s.environment
        AND co.synthetic=s.synthetic AND co.context_key=s.context_key AND co.giver_id=s.giver_id
        AND co.amount_minor=s.amount_minor AND co.transaction_fee_minor=s.transaction_fee_minor
      JOIN giving_givers g ON g.id=s.giver_id AND g.environment=s.environment
        AND g.synthetic=s.synthetic AND g.context_key=s.context_key
      WHERE s.id=$1 AND s.environment=$2
      FOR UPDATE OF c,s,co
    `, [candidate.id,candidate.environment])).rows[0]
    if (!row || row.provider_schedule_id !== candidate.provider_schedule_id || row.provider_consent_id !== candidate.provider_consent_id ||
      schedule.fixed_recurring_payment_id !== row.provider_schedule_id || schedule.consent_id !== row.provider_consent_id) {
      throw new Error('Recurring schedule provenance mismatch')
    }
    assertPaymentDetails(schedule, row)
    if (!['active','cancelled'].includes(schedule.status)) throw new Error('Unexpected recurring schedule status')
    validateNzDate(schedule.next_payment_date)
    if (schedule.status_updated_timestamp) validateIsoTimestamp(schedule.status_updated_timestamp)

    for (const payment of payments) {
      if (payment.detail.consent_id !== row.provider_consent_id) throw new Error('Recurring payment consent mismatch')
      assertPaymentDetails(payment.detail, row)
      validateIsoTimestamp(payment.creation_timestamp)
      validateIsoTimestamp(payment.status_updated_timestamp)
      await client.query(`INSERT INTO giving_gifts(
          context_key,environment,synthetic,checkout_id,giver_id,consent_id,schedule_id,
          fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,transaction_fee_minor,provider_payment_id,status,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending',$15)
        ON CONFLICT(environment,provider_payment_id) DO NOTHING`, [
        row.context_key,row.environment,row.synthetic,row.checkout_id,row.giver_id,row.consent_id,row.id,
        row.fund_id,row.fund_name,row.fund_code,row.fund_accounting_key,row.amount_minor,row.transaction_fee_minor,
        payment.payment_id,payment.creation_timestamp,
      ])
      // Lock and verify an existing gift too: a duplicate ID must never move between donors or schedules.
      const gift = (await client.query(`SELECT id,status,provider_status,provider_status_updated_at,
          context_key,synthetic,checkout_id,giver_id,consent_id,schedule_id,amount_minor,transaction_fee_minor
        FROM giving_gifts WHERE environment=$1 AND provider_payment_id=$2 FOR UPDATE`, [row.environment,payment.payment_id])).rows[0]
      if (!gift || gift.context_key !== row.context_key || gift.synthetic !== row.synthetic ||
        Number(gift.checkout_id) !== row.checkout_id || Number(gift.giver_id) !== row.giver_id ||
        Number(gift.consent_id) !== row.consent_id || Number(gift.schedule_id) !== row.id ||
        Number(gift.amount_minor) !== Number(row.amount_minor) || Number(gift.transaction_fee_minor) !== Number(row.transaction_fee_minor)) {
        throw new Error('Recurring gift provenance mismatch')
      }
      const previousTime = gift.provider_status_updated_at ? new Date(gift.provider_status_updated_at).getTime() : null
      const incomingTime = new Date(payment.status_updated_timestamp).getTime()
      if (previousTime === incomingTime && gift.provider_status !== payment.status) throw new Error('Conflicting recurring payment observation')
      if (previousTime === null || incomingTime > previousTime) {
        const status = ['settled','failed','cancelled'].includes(gift.status) ? gift.status : paymentStatus(payment.status)
        await client.query(`UPDATE giving_gifts SET status=$2,provider_status=$3,provider_status_updated_at=$4,
          provider_verified_at=$5,provider_observed_at=$4,provider_source='reconciliation',provider_request_id=$6,updated_at=$5 WHERE id=$1`,
        [gift.id,status,payment.status,payment.status_updated_timestamp,observedAt,payment.provider_correlation_id ?? null])
      }
    }
    // Dates can advance while provider status stays 'active' and its status timestamp stays unchanged.
    // Use the read's start time to prevent a slower, older read overwriting a more recent observation.
    await client.query(`UPDATE giving_schedules SET
        status=CASE WHEN status IN ('cancelled','failed','cancel_pending') THEN status ELSE $2 END,
        provider_status=$2,provider_status_updated_at=COALESCE($3,provider_status_updated_at),
        next_payment_date=$4,provider_verified_at=$5,provider_observed_at=$5,
        provider_source='reconciliation',provider_request_id=$6,updated_at=$5
      WHERE id=$1 AND (provider_verified_at IS NULL OR provider_verified_at<=$5)`,
    [row.id,schedule.status,schedule.status_updated_timestamp ?? null,`${schedule.next_payment_date}T00:00:00.000Z`,observedAt,schedule.provider_correlation_id ?? null])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function reconcileRecurringGiving(input: { pool: Pool; provider(environment: GivingEnvironment): LifecycleProvider; now?: () => Date }) {
  const { pool } = input
  const now = input.now ?? (() => new Date())
  const result = { recurringSchedules: 0, recurringFailures: 0 }
  const maxId = Number((await pool.query('SELECT COALESCE(MAX(id),0) id FROM giving_schedules')).rows[0].id)
  let cursor = 0
  // Keyset pages include cancelled schedules: an in-flight payment may settle after cancellation.
  while (cursor < maxId) {
    const candidates = (await pool.query<RecurringCandidate>(`SELECT s.id,s.environment,s.provider_schedule_id,c.provider_consent_id
      FROM giving_schedules s JOIN giving_consents c ON c.id=s.consent_id
      WHERE s.id>$1 AND s.id<=$2 ORDER BY s.id LIMIT 100`, [cursor,maxId])).rows
    if (!candidates.length) break
    for (let offset = 0; offset < candidates.length; offset += 4) {
      await Promise.all(candidates.slice(offset,offset+4).map(async (candidate) => {
        result.recurringSchedules++
        try {
          const observedAt = now()
          const provider = input.provider(candidate.environment)
          const schedule = await provider.getFixedRecurringPayment(candidate.provider_schedule_id)
          const consent = await provider.getEnduringConsent(candidate.provider_consent_id)
          if (consent.consent_id !== candidate.provider_consent_id) throw new Error('Recurring consent response mismatch')
          const known = new Set((await pool.query<{ provider_payment_id: string }>(`SELECT provider_payment_id FROM giving_gifts
            WHERE environment=$1 AND schedule_id=$2 AND status IN ('settled','failed','cancelled')
              AND provider_verified_at IS NOT NULL`, [candidate.environment,candidate.id])).rows.map(row => row.provider_payment_id))
          const payments: BlinkPayPayment[] = []
          for (const payment of consent.payments) {
            if (known.has(payment.payment_id)) continue
            const verified = await provider.getPayment(payment.payment_id)
            if (verified.payment_id !== payment.payment_id) throw new Error('Recurring payment response mismatch')
            payments.push(verified)
          }
          await recordRecurringObservation(pool,candidate,schedule,payments,observedAt)
        } catch {
          result.recurringFailures++
          // Never log payment bodies, donor details, credentials, or provider error responses.
          console.error({ category:'giving-recurring-reconciliation-failed',scheduleId:candidate.id,environment:candidate.environment })
        }
      }))
    }
    cursor = candidates[candidates.length-1]!.id
  }
  return result
}
