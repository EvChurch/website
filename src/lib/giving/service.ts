import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

import type { GivingFrequency } from '@/components/giving/giving-state'
import type { GivingIdentityInput, ResolvedGivingIdentity } from './rock-identity'
import type { GivingCheckoutStatus, GivingContext, ProviderOperationAction, ProviderOperationStatus } from './contracts'
import type {
  BlinkPayAmount,
  BlinkPayConsent,
  BlinkPayFixedRecurringPayment,
  BlinkPayMutationResult,
  BlinkPayOperationKeys,
  BlinkPayQuickPayment,
  CreateEnduringConsentRequest,
  CreateFixedRecurringPaymentRequest,
  CreateQuickPaymentRequest,
} from './blinkpay/types'
import { minorUnitsToNzd, validateNzDate, validatePeriod } from './blinkpay/validation'

const CAPABILITY_TTL_MS = 30 * 60 * 1000
const SUBMISSION_KEY = /^[A-Za-z0-9_-]{43}$/u
const CONTROL = /[\u0000-\u001f\u007f]/u

export type CheckoutResultCode = 'processing' | 'cancelled' | 'rejected' | 'expired' | 'unknown' | 'verified'

export interface GivingCheckoutSubmission {
  submissionKey: string
  amountMinor: number
  fundId: number
  frequency: GivingFrequency
  firstPaymentDate: string | null
  firstName: string
  lastName: string
  email: string
  turnstileToken: string
}

export interface GivingCheckoutRecord extends GivingContext {
  id: number
  giverId: number | null
  bankReference: string | null
  fundId: number
  fundName: string
  fundCode: string
  fundAccountingKey: string
  amountMinor: number
  frequency: GivingFrequency
  firstPaymentDate: string | null
  correlationKey: string
  submissionKeyDigest: string
  submissionDigest: string
  gatewayRedirectUri: string | null
  status: 'draft' | 'authorising' | 'verifying' | 'unknown' | 'completed' | 'failed'
  resultCode: CheckoutResultCode | null
}

export interface GivingCheckoutOperation {
  id: number
  action: Extract<ProviderOperationAction, 'blinkpay.create-payment' | 'blinkpay.create-consent' | 'blinkpay.create-schedule'>
  status: ProviderOperationStatus
  providerId: string | null
  requestId: string
  idempotencyKey: string
  requestDigest: string
}

interface CreateCheckoutInput extends GivingContext {
  submission: GivingCheckoutSubmission
  submissionKeyDigest: string
  submissionDigest: string
  correlationKey: string
  returnCapabilityDigest: string
  returnCapabilityExpiresAt: Date
}

export interface GivingCheckoutRepository {
  createOrReuse(input: CreateCheckoutInput): Promise<{ checkout: GivingCheckoutRecord; reused: boolean; canStart: boolean }>
  get(checkoutId: number): Promise<GivingCheckoutRecord | null>
  rotateStatusCapability(checkoutId: number, statusDigest: string, bindingDigest: string, expiresAt: Date): Promise<void>
  prepareOperation(checkout: GivingCheckoutRecord, action: GivingCheckoutOperation['action'], requestDigest: string, keys: BlinkPayOperationKeys): Promise<GivingCheckoutOperation>
  markSubmitted(operationId: number): Promise<void>
  markUnknown(operationId: number, code: string): Promise<void>
  markFailed(operationId: number, code: string): Promise<void>
  recordHostedSuccess(input: { checkout: GivingCheckoutRecord; operation: GivingCheckoutOperation; providerId: string; gatewayRedirectUri: string; providerRequestId?: string }): Promise<void>
  consumeReturn(returnDigest: string, expectedProviderId: string | null, now: Date, statusDigest: string, bindingDigest: string, statusExpiresAt: Date): Promise<GivingCheckoutRecord | null>
  findByStatusCapability(statusDigest: string, now: Date): Promise<GivingCheckoutRecord | null>
  findOperation(checkoutId: number, action: GivingCheckoutOperation['action']): Promise<GivingCheckoutOperation | null>
  completeOneOff(checkout: GivingCheckoutRecord, paymentId: string, observedAt: Date, providerRequestId?: string): Promise<void>
  recordConsentAuthorised(checkout: GivingCheckoutRecord, consentId: string, observedAt: Date, providerRequestId?: string): Promise<number>
  bindScheduleProviderId(checkout: GivingCheckoutRecord, operation: GivingCheckoutOperation, consentId: number, providerScheduleId: string, providerRequestId?: string): Promise<void>
  completeSchedule(checkout: GivingCheckoutRecord, provider: BlinkPayFixedRecurringPayment, observedAt: Date): Promise<void>
  setProcessing(checkoutId: number): Promise<void>
  setFailed(checkoutId: number, code: Extract<CheckoutResultCode, 'cancelled' | 'rejected' | 'expired'>): Promise<void>
}

export interface GivingCheckoutBlinkPayClient {
  createQuickPayment(input: CreateQuickPaymentRequest, keys: BlinkPayOperationKeys): Promise<BlinkPayMutationResult<{ quick_payment_id: string; redirect_uri: string }>>
  getQuickPayment(id: string): Promise<BlinkPayQuickPayment>
  createEnduringConsent(input: CreateEnduringConsentRequest, keys: BlinkPayOperationKeys): Promise<BlinkPayMutationResult<{ consent_id: string; redirect_uri: string }>>
  getEnduringConsent(id: string): Promise<BlinkPayConsent>
  createFixedRecurringPayment(input: CreateFixedRecurringPaymentRequest, keys: BlinkPayOperationKeys): Promise<BlinkPayMutationResult<{ fixed_recurring_payment_id: string }>>
  getFixedRecurringPayment(id: string): Promise<BlinkPayFixedRecurringPayment>
  isPaymentSettled(value: { status: string }): boolean
  isConsentAuthorised(value: { status: string }): boolean
  isFixedRecurringPaymentActive(value: { status: string }): boolean
}

interface GivingCheckoutDependencies {
  repository: GivingCheckoutRepository
  blinkPay: GivingCheckoutBlinkPayClient | ((environment: GivingContext['environment']) => GivingCheckoutBlinkPayClient)
  resolveIdentity(input: GivingContext & { checkoutId: number; identity: GivingIdentityInput }): Promise<ResolvedGivingIdentity>
  digestSecret: string
  now?: () => Date
  randomBytes?: (size: number) => Buffer
  uuid?: () => string
}

export class GivingCheckoutError extends Error {
  constructor(public readonly code: 'invalid' | 'unavailable' | 'unknown' | 'conflict') {
    super('Giving checkout unavailable')
    this.name = 'GivingCheckoutError'
  }
}

function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !CONTROL.test(value)
}

export function validateGivingCheckoutSubmission(value: unknown): GivingCheckoutSubmission {
  const keys = ['submissionKey','amountMinor','fundId','frequency','firstPaymentDate','firstName','lastName','email','turnstileToken']
  if (!exactObject(value, keys)) throw new GivingCheckoutError('invalid')
  const frequency = String(value.frequency)
  if (!SUBMISSION_KEY.test(String(value.submissionKey)) || !Number.isSafeInteger(value.amountMinor) || Number(value.amountMinor) <= 0 ||
      !Number.isSafeInteger(value.fundId) || Number(value.fundId) <= 0 ||
      !['one-off','daily','weekly','fortnightly','monthly','annual'].includes(frequency) ||
      !boundedText(value.firstName, 100) || !boundedText(value.lastName, 100) || !boundedText(value.email, 320) || !boundedText(value.turnstileToken, 4096)) {
    throw new GivingCheckoutError('invalid')
  }
  const firstPaymentDate = value.firstPaymentDate
  if (frequency === 'one-off') {
    if (firstPaymentDate !== null) throw new GivingCheckoutError('invalid')
  } else {
    if (typeof firstPaymentDate !== 'string') throw new GivingCheckoutError('invalid')
    validatePeriod(frequency)
    validateNzDate(firstPaymentDate)
  }
  return value as unknown as GivingCheckoutSubmission
}

function hmac(secret: string, value: string) {
  if (Buffer.byteLength(secret) < 32) throw new GivingCheckoutError('unavailable')
  return createHmac('sha256', secret).update(value).digest('hex')
}

function submissionKeyDigest(secret: string, context: GivingContext, submissionKey: string) {
  return hmac(secret, `giving-checkout-key-v1\0${context.contextKey}\0${context.environment}\0${context.e2eRunId ?? ''}\0${submissionKey}`)
}

function canonicalSubmissionDigest(secret: string, submission: GivingCheckoutSubmission) {
  const canonical = JSON.stringify({
    amountMinor: submission.amountMinor,
    fundId: submission.fundId,
    frequency: submission.frequency,
    firstPaymentDate: submission.firstPaymentDate,
    firstName: submission.firstName.normalize('NFC').trim(),
    lastName: submission.lastName.normalize('NFC').trim(),
    email: submission.email.normalize('NFC').trim().toLowerCase(),
  })
  return hmac(secret, `giving-checkout-request-v1\0${canonical}`)
}

function capabilityDigest(purpose: 'return' | 'status', token: string) {
  return createHash('sha256').update(`giving-checkout-v1\0${purpose}\0${token}`).digest('base64url')
}

function requestDigest(action: string, checkout: GivingCheckoutRecord) {
  return createHash('sha256').update(JSON.stringify({ action, checkoutId: checkout.id, contextKey: checkout.contextKey, amountMinor: checkout.amountMinor, frequency: checkout.frequency, firstPaymentDate: checkout.firstPaymentDate, fundCode: checkout.fundCode, bankReference: checkout.bankReference })).digest('hex')
}

function amount(amountMinor: number): BlinkPayAmount { return { total: minorUnitsToNzd(amountMinor), currency: 'NZD' } }
function keys(operation: GivingCheckoutOperation): BlinkPayOperationKeys { return { requestId: operation.requestId, idempotencyKey: operation.idempotencyKey } }
function failedConsent(status: string): 'cancelled' | 'rejected' | 'expired' | null {
  const normal = status.toLowerCase()
  if (normal.includes('cancel')) return 'cancelled'
  if (normal.includes('expir')) return 'expired'
  if (normal.includes('reject') || normal.includes('fail')) return 'rejected'
  return null
}

export function createGivingCheckoutService(dependencies: GivingCheckoutDependencies) {
  const now = dependencies.now ?? (() => new Date())
  const random = dependencies.randomBytes ?? randomBytes
  const uuid = dependencies.uuid ?? randomUUID
  const operationKeys = () => ({ requestId: `ev-${uuid()}`, idempotencyKey: `ev-${uuid()}` })
  const blinkPayFor = (checkout: GivingCheckoutRecord) => typeof dependencies.blinkPay === 'function' ? dependencies.blinkPay(checkout.environment) : dependencies.blinkPay

  async function executeHosted(checkout: GivingCheckoutRecord, action: Extract<GivingCheckoutOperation['action'], 'blinkpay.create-payment' | 'blinkpay.create-consent'>, returnToken: string) {
    const blinkPay = blinkPayFor(checkout)
    let operation = await dependencies.repository.prepareOperation(checkout, action, requestDigest(action, checkout), operationKeys())
    if (operation.status === 'succeeded') {
      if (!checkout.gatewayRedirectUri) throw new GivingCheckoutError('unknown')
      return checkout.gatewayRedirectUri
    }
    if (operation.status !== 'prepared') throw new GivingCheckoutError('unknown')
    await dependencies.repository.markSubmitted(operation.id)
    operation = { ...operation, status: 'submitted' }
    const redirectUri = `https://www.ev.church/give/return/${returnToken}`
    if (!checkout.bankReference) throw new GivingCheckoutError('conflict')
    const pcr = { particulars: checkout.fundCode.slice(0, 12), reference: checkout.bankReference }
    let result
    try {
      result = action === 'blinkpay.create-payment'
        ? await blinkPay.createQuickPayment({ type: 'single', flow: { detail: { type: 'gateway', redirect_uri: redirectUri } }, amount: amount(checkout.amountMinor), pcr }, keys(operation))
        : await blinkPay.createEnduringConsent({ type: 'enduring', flow: { detail: { type: 'gateway', redirect_uri: redirectUri } }, from_timestamp: now().toISOString(), period: checkout.frequency as Exclude<GivingFrequency, 'one-off'>, maximum_amount_period: amount(checkout.amountMinor), maximum_amount_payment: amount(checkout.amountMinor) }, keys(operation))
    } catch (error) {
      const rejected = typeof error === 'object' && error !== null && 'code' in error && error.code === 'request-rejected'
      if (rejected) {
        await dependencies.repository.markFailed(operation.id, 'rejected')
        await dependencies.repository.setFailed(checkout.id, 'rejected')
      } else {
        await dependencies.repository.markUnknown(operation.id, 'request-ambiguous')
      }
      throw new GivingCheckoutError(rejected ? 'unavailable' : 'unknown')
    }
    if (result.outcome === 'unknown') {
      await dependencies.repository.markUnknown(operation.id, result.reason)
      throw new GivingCheckoutError('unknown')
    }
    const providerId = 'quick_payment_id' in result.value ? result.value.quick_payment_id : result.value.consent_id
    try {
      await dependencies.repository.recordHostedSuccess({ checkout, operation, providerId, gatewayRedirectUri: result.value.redirect_uri, providerRequestId: result.metadata.correlationId })
    } catch {
      await dependencies.repository.markUnknown(operation.id, 'provider-accepted-binding-failed').catch(() => undefined)
      throw new GivingCheckoutError('unknown')
    }
    return result.value.redirect_uri
  }

  async function start(input: GivingContext & { submission: GivingCheckoutSubmission }) {
    const submission = validateGivingCheckoutSubmission(input.submission)
    const current = now()
    const returnToken = random(32).toString('base64url')
    const statusToken = random(32).toString('base64url')
    const keyDigest = submissionKeyDigest(dependencies.digestSecret, input, submission.submissionKey)
    const submissionDigest = canonicalSubmissionDigest(dependencies.digestSecret, submission)
    const created = await dependencies.repository.createOrReuse({
      ...input, submission, submissionKeyDigest: keyDigest, submissionDigest, correlationKey: uuid(),
      returnCapabilityDigest: capabilityDigest('return', returnToken),
      returnCapabilityExpiresAt: new Date(current.getTime() + CAPABILITY_TTL_MS),
    })
    let checkout = created.checkout
    await dependencies.repository.rotateStatusCapability(checkout.id, capabilityDigest('status', statusToken), capabilityDigest('status', statusToken), new Date(current.getTime() + CAPABILITY_TTL_MS))
    if (created.reused && checkout.gatewayRedirectUri) return { gatewayRedirectUri: checkout.gatewayRedirectUri, statusToken, correlationKey: checkout.correlationKey, reused: true }
    if (!created.canStart) throw new GivingCheckoutError('unknown')
    const identity: GivingIdentityInput = { kind: 'guest', firstName: submission.firstName, lastName: submission.lastName, email: submission.email }
    const resolvedIdentity = await dependencies.resolveIdentity({ contextKey: checkout.contextKey, environment: checkout.environment, synthetic: checkout.synthetic, e2eRunId: checkout.e2eRunId, checkoutId: checkout.id, identity })
    checkout = (await dependencies.repository.get(checkout.id)) ?? checkout
    checkout = { ...checkout, giverId: resolvedIdentity.giverId, bankReference: resolvedIdentity.bankReference }
    const gatewayRedirectUri = await executeHosted(checkout, checkout.frequency === 'one-off' ? 'blinkpay.create-payment' : 'blinkpay.create-consent', returnToken)
    return { gatewayRedirectUri, statusToken, correlationKey: checkout.correlationKey, reused: false }
  }

  async function continueRecurring(checkout: GivingCheckoutRecord, consentId: string) {
    const blinkPay = blinkPayFor(checkout)
    const consent = await blinkPay.getEnduringConsent(consentId)
    if (!blinkPay.isConsentAuthorised(consent)) {
      const failure = failedConsent(consent.status)
      if (failure) await dependencies.repository.setFailed(checkout.id, failure)
      else await dependencies.repository.setProcessing(checkout.id)
      return
    }
    const localConsentId = await dependencies.repository.recordConsentAuthorised(checkout, consentId, new Date(consent.status_updated_timestamp), consent.provider_correlation_id)
    let operation = await dependencies.repository.prepareOperation(checkout, 'blinkpay.create-schedule', requestDigest('blinkpay.create-schedule', checkout), operationKeys())
    if (operation.status === 'unknown' || operation.status === 'submitted') {
      if (!operation.providerId) return
    } else if (operation.status === 'prepared') {
      await dependencies.repository.markSubmitted(operation.id)
      operation = { ...operation, status: 'submitted' }
      let result
      try {
        result = await blinkPay.createFixedRecurringPayment({
          consent_id: consentId, consent_status: consent.status, period: checkout.frequency as Exclude<GivingFrequency, 'one-off'>,
          start_date: checkout.firstPaymentDate!, amount: amount(checkout.amountMinor), amount_minor: checkout.amountMinor,
          maximum_amount_payment_minor: checkout.amountMinor, maximum_amount_period_minor: checkout.amountMinor,
          pcr: { particulars: checkout.fundCode.slice(0, 12), reference: checkout.bankReference ?? (() => { throw new GivingCheckoutError('conflict') })() }, retry_strategy: 'same_day',
        }, keys(operation))
      } catch (error) {
        const rejected = typeof error === 'object' && error !== null && 'code' in error && error.code === 'request-rejected'
        if (rejected) {
          await dependencies.repository.markFailed(operation.id, 'rejected')
          await dependencies.repository.setFailed(checkout.id, 'rejected')
        } else {
          await dependencies.repository.markUnknown(operation.id, 'request-ambiguous')
        }
        return
      }
      if (result.outcome === 'unknown') { await dependencies.repository.markUnknown(operation.id, result.reason); return }
      try {
        await dependencies.repository.bindScheduleProviderId(checkout, operation, localConsentId, result.value.fixed_recurring_payment_id, result.metadata.correlationId)
      } catch {
        await dependencies.repository.markUnknown(operation.id, 'provider-accepted-binding-failed').catch(() => undefined)
        return
      }
      operation = { ...operation, status: 'succeeded', providerId: result.value.fixed_recurring_payment_id }
    }
    if (!operation.providerId) return
    const schedule = await blinkPay.getFixedRecurringPayment(operation.providerId)
    if (blinkPay.isFixedRecurringPaymentActive(schedule)) await dependencies.repository.completeSchedule(checkout, schedule, now())
    else await dependencies.repository.setProcessing(checkout.id)
  }

  async function verify(checkoutId: number) {
    const checkout = await dependencies.repository.get(checkoutId)
    if (!checkout) throw new GivingCheckoutError('unavailable')
    if (checkout.frequency === 'one-off') {
      const blinkPay = blinkPayFor(checkout)
      const operation = await dependencies.repository.findOperation(checkout.id, 'blinkpay.create-payment')
      if (!operation?.providerId) return dependencies.repository.setProcessing(checkout.id)
      const quick = await blinkPay.getQuickPayment(operation.providerId)
      const settled = quick.consent.payments.find((payment) => blinkPay.isPaymentSettled(payment))
      if (settled) await dependencies.repository.completeOneOff(checkout, settled.payment_id, new Date(settled.status_updated_timestamp), settled.provider_correlation_id)
      else {
        const failure = failedConsent(quick.consent.status)
        if (failure) await dependencies.repository.setFailed(checkout.id, failure)
        else await dependencies.repository.setProcessing(checkout.id)
      }
      return
    }
    const operation = await dependencies.repository.findOperation(checkout.id, 'blinkpay.create-consent')
    if (!operation?.providerId) return dependencies.repository.setProcessing(checkout.id)
    await continueRecurring(checkout, operation.providerId)
  }

  return {
    start,
    verify,
    continueRecurring,
    async consumeReturn(token: string, expectedProviderId: string | null = null) {
      if (!SUBMISSION_KEY.test(token)) throw new GivingCheckoutError('unavailable')
      const statusToken = random(32).toString('base64url')
      const current = now()
      const checkout = await dependencies.repository.consumeReturn(capabilityDigest('return', token), expectedProviderId, current, capabilityDigest('status', statusToken), capabilityDigest('status', statusToken), new Date(current.getTime() + CAPABILITY_TTL_MS))
      if (!checkout) throw new GivingCheckoutError('unavailable')
      try {
        await verify(checkout.id)
      } catch {
        await dependencies.repository.setProcessing(checkout.id)
      }
      return { statusToken, checkoutId: checkout.id }
    },
    async status(token: string) {
      if (!SUBMISSION_KEY.test(token)) throw new GivingCheckoutError('unavailable')
      const statusDigest = capabilityDigest('status', token)
      let checkout = await dependencies.repository.findByStatusCapability(statusDigest, now())
      if (!checkout) throw new GivingCheckoutError('unavailable')
      if (checkout.status !== 'completed' && checkout.status !== 'failed') {
        try {
          await verify(checkout.id)
        } catch {
          await dependencies.repository.setProcessing(checkout.id).catch(() => undefined)
        }
        checkout = await dependencies.repository.findByStatusCapability(statusDigest, now())
        if (!checkout) throw new GivingCheckoutError('unavailable')
      }
      const state = checkout.status === 'completed' ? 'verified' : checkout.status === 'failed' ? checkout.resultCode ?? 'rejected' : checkout.status === 'unknown' ? 'unknown' : 'processing'
      return { state, retryAllowed: checkout.status === 'failed', kind: checkout.frequency === 'one-off' ? 'one-off' : 'recurring' } satisfies GivingCheckoutStatus
    },
  }
}

async function tx<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

type CheckoutRow = Record<string, unknown>
function checkoutRow(row: CheckoutRow | undefined): GivingCheckoutRecord | null {
  if (!row) return null
  return {
    id: Number(row.id),
    contextKey: String(row.context_key),
    environment: row.environment as GivingContext['environment'],
    synthetic: Boolean(row.synthetic),
    e2eRunId: row.e2e_run_id === null ? null : Number(row.e2e_run_id),
    giverId: row.giver_id === null ? null : Number(row.giver_id),
    bankReference: row.bank_reference ? String(row.bank_reference) : null,
    fundId: Number(row.fund_id),
    fundName: String(row.fund_name),
    fundCode: String(row.fund_code),
    fundAccountingKey: String(row.fund_accounting_key),
    amountMinor: Number(row.amount_minor),
    frequency: row.frequency as GivingFrequency,
    firstPaymentDate: row.first_payment_date ? String(row.first_payment_date).slice(0, 10) : null,
    correlationKey: String(row.correlation_key),
    submissionKeyDigest: String(row.submission_key_digest),
    submissionDigest: String(row.submission_digest),
    gatewayRedirectUri: row.gateway_redirect_uri ? String(row.gateway_redirect_uri) : null,
    status: row.status as GivingCheckoutRecord['status'],
    resultCode: row.result_code as CheckoutResultCode | null,
  }
}
function operationRow(row: CheckoutRow | undefined): GivingCheckoutOperation | null {
  if (!row || typeof row.request_id !== 'string' || typeof row.idempotency_key !== 'string') return null
  return {
    id: Number(row.id),
    action: row.action as GivingCheckoutOperation['action'],
    status: row.status as ProviderOperationStatus,
    providerId: row.provider_id ? String(row.provider_id) : null,
    requestId: row.request_id,
    idempotencyKey: row.idempotency_key,
    requestDigest: String(row.request_digest),
  }
}
const CHECKOUT_COLUMNS = 'id,context_key,environment,synthetic,e2e_run_id,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,frequency,first_payment_date,correlation_key,submission_key_digest,submission_digest,gateway_redirect_uri,status,result_code'
const CHECKOUT_SELECT = `${CHECKOUT_COLUMNS},(SELECT bank_reference FROM giving_givers WHERE giving_givers.id=giving_checkouts.giver_id) AS bank_reference`

export function createPostgresGivingCheckoutRepository(pool: Pool): GivingCheckoutRepository {
  return {
    createOrReuse(input) {
      return tx(pool, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [input.submissionKeyDigest])
        const existing = checkoutRow((await client.query(
          `SELECT ${CHECKOUT_SELECT} FROM giving_checkouts WHERE submission_key_digest=$1 FOR UPDATE`,
          [input.submissionKeyDigest],
        )).rows[0])
        if (existing) {
          const sameRequest = existing.submissionDigest === input.submissionDigest &&
            existing.contextKey === input.contextKey &&
            existing.environment === input.environment &&
            existing.synthetic === input.synthetic &&
            existing.e2eRunId === input.e2eRunId
          if (!sameRequest) throw new GivingCheckoutError('conflict')
          const reachedProvider = Boolean((await client.query<{ reached: boolean }>(`
            SELECT EXISTS(
              SELECT 1 FROM giving_provider_operations
              WHERE checkout_id=$1 AND status IN ('submitted','succeeded','unknown')
            ) AS reached
          `, [existing.id])).rows[0]?.reached)
          if (reachedProvider && !existing.gatewayRedirectUri) {
            await client.query(`UPDATE giving_checkouts SET status='unknown',result_code='unknown',updated_at=now() WHERE id=$1`, [existing.id])
            return { checkout: { ...existing, status: 'unknown', resultCode: 'unknown' }, reused: true, canStart: false }
          }
          const rotated = checkoutRow((await client.query(`
            UPDATE giving_checkouts
            SET return_capability_digest=$2,return_capability_expires_at=$3,return_capability_consumed_at=NULL,updated_at=now()
            WHERE id=$1 RETURNING ${CHECKOUT_SELECT}
          `, [existing.id, input.returnCapabilityDigest, input.returnCapabilityExpiresAt])).rows[0])
          if (!rotated) throw new GivingCheckoutError('conflict')
          return { checkout: rotated, reused: true, canStart: true }
        }

        const fund = (await client.query(
          'SELECT id,name,code,accounting_key FROM giving_funds WHERE id=$1 AND active FOR UPDATE',
          [input.submission.fundId],
        )).rows[0]
        if (!fund) throw new GivingCheckoutError('invalid')
        const result = await client.query(`
          INSERT INTO giving_checkouts(
            context_key,environment,synthetic,e2e_run_id,fund_id,fund_name,fund_code,fund_accounting_key,
            amount_minor,frequency,first_payment_date,correlation_key,submission_key_digest,submission_digest,
            return_capability_digest,return_capability_expires_at,status
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'draft')
          RETURNING ${CHECKOUT_COLUMNS}
        `, [
          input.contextKey, input.environment, input.synthetic, input.e2eRunId,
          fund.id, fund.name, fund.code, fund.accounting_key,
          input.submission.amountMinor, input.submission.frequency, input.submission.firstPaymentDate,
          input.correlationKey, input.submissionKeyDigest, input.submissionDigest,
          input.returnCapabilityDigest, input.returnCapabilityExpiresAt,
        ])
        return { checkout: { ...checkoutRow(result.rows[0])!, bankReference: null }, reused: false, canStart: true }
      })
    },
    async get(id) {
      return checkoutRow((await pool.query(`SELECT ${CHECKOUT_SELECT} FROM giving_checkouts WHERE id=$1`, [id])).rows[0])
    },
    async rotateStatusCapability(id, digest, binding, expires) {
      const result = await pool.query(`
        UPDATE giving_checkouts
        SET status_capability_digest=$2,status_binding_digest=$3,status_capability_expires_at=$4,updated_at=now()
        WHERE id=$1
      `, [id, digest, binding, expires])
      if (result.rowCount !== 1) throw new GivingCheckoutError('unavailable')
    },
    prepareOperation(checkout,action,digest,operationKeys) { return tx(pool, async (client) => {
      await client.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,e2e_run_id,checkout_id,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status)
        VALUES($1,$2,$3,$4,$5,'blinkpay',$6,1,$7,$8,$9,$10,'prepared') ON CONFLICT(checkout_id,provider,action,logical_version) DO NOTHING`, [checkout.contextKey,checkout.environment,checkout.synthetic,checkout.e2eRunId,checkout.id,action,digest,checkout.correlationKey,operationKeys.requestId,operationKeys.idempotencyKey])
      const row = (await client.query('SELECT id,action,status,provider_id,request_id,idempotency_key,request_digest FROM giving_provider_operations WHERE checkout_id=$1 AND provider=\'blinkpay\' AND action=$2 AND logical_version=1 FOR UPDATE',[checkout.id,action])).rows[0]
      const operation = operationRow(row)
      if (!operation || operation.requestDigest !== digest) throw new GivingCheckoutError('conflict')
      return operation
    }) },
    async markSubmitted(id) {
      const result = await pool.query(`
        WITH updated AS (
          UPDATE giving_provider_operations SET status='submitted',updated_at=now()
          WHERE id=$1 AND status='prepared' RETURNING id,request_id
        ), next_attempt AS (
          SELECT COALESCE(MAX(attempt_number),0)+1 value FROM giving_provider_operation_attempts WHERE operation_id=$1
        )
        INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id)
        SELECT updated.id,next_attempt.value,'submitted',updated.request_id FROM updated CROSS JOIN next_attempt RETURNING id
      `, [id])
      if (result.rowCount !== 1) throw new GivingCheckoutError('conflict')
    },
    async markUnknown(id, code) {
      const operation = await pool.query(`
        WITH updated AS (
          UPDATE giving_provider_operations SET status='unknown',updated_at=now()
          WHERE id=$1 AND status='submitted' RETURNING id
        ), next_attempt AS (
          SELECT COALESCE(MAX(attempt_number),0)+1 value FROM giving_provider_operation_attempts WHERE operation_id=$1
        )
        INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,error_code)
        SELECT updated.id,next_attempt.value,'unknown',$2 FROM updated CROSS JOIN next_attempt RETURNING id
      `, [id, code])
      if (operation.rowCount !== 1) throw new GivingCheckoutError('conflict')
      await pool.query(`
        UPDATE giving_checkouts SET status='unknown',result_code='unknown',updated_at=now()
        WHERE id=(SELECT checkout_id FROM giving_provider_operations WHERE id=$1)
      `, [id])
    },
    async markFailed(id, _code) {
      const result = await pool.query(`
        UPDATE giving_provider_operations SET status='failed',updated_at=now()
        WHERE id=$1 AND status IN ('prepared','submitted','unknown')
      `, [id])
      if (result.rowCount !== 1) throw new GivingCheckoutError('conflict')
    },
    recordHostedSuccess(input) {
      return tx(pool, async (client) => {
        const operation = await client.query(`
          WITH updated AS (
            UPDATE giving_provider_operations
            SET status='succeeded',provider_id=$2,provider_request_id=COALESCE($3,provider_request_id),updated_at=now()
            WHERE id=$1 AND checkout_id=$4 AND status='submitted'
            RETURNING id
          ), next_attempt AS (
            SELECT COALESCE(MAX(attempt_number),0)+1 value FROM giving_provider_operation_attempts WHERE operation_id=$1
          )
          INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id)
          SELECT updated.id,next_attempt.value,'succeeded',$3 FROM updated CROSS JOIN next_attempt RETURNING id
        `, [input.operation.id, input.providerId, input.providerRequestId ?? null, input.checkout.id])
        if (operation.rowCount !== 1) throw new GivingCheckoutError('conflict')
        const checkout = await client.query(`
          UPDATE giving_checkouts SET status='authorising',gateway_redirect_uri=$2,result_code='processing',updated_at=now()
          WHERE id=$1 AND context_key=$3 AND status IN ('draft','unknown') RETURNING id
        `, [input.checkout.id, input.gatewayRedirectUri, input.checkout.contextKey])
        if (checkout.rowCount !== 1) throw new GivingCheckoutError('conflict')
      })
    },
    consumeReturn(digest, expectedProviderId, now, statusDigest, binding, expires) {
      return tx(pool, async (client) => checkoutRow((await client.query(`
        UPDATE giving_checkouts
        SET return_capability_consumed_at=$3,status_capability_digest=$4,status_binding_digest=$5,
            status_capability_expires_at=$6,status='verifying',updated_at=now()
        WHERE return_capability_digest=$1
          AND return_capability_consumed_at IS NULL
          AND return_capability_expires_at>$3
          AND ($2::varchar IS NULL OR EXISTS(
            SELECT 1 FROM giving_provider_operations operation
            WHERE operation.checkout_id=giving_checkouts.id
              AND operation.provider='blinkpay'
              AND operation.action IN ('blinkpay.create-payment','blinkpay.create-consent')
              AND operation.provider_id=$2
          ))
        RETURNING ${CHECKOUT_SELECT}
      `, [digest, expectedProviderId, now, statusDigest, binding, expires])).rows[0]))
    },
    async findByStatusCapability(digest, now) {
      return checkoutRow((await pool.query(`
        SELECT ${CHECKOUT_SELECT} FROM giving_checkouts
        WHERE status_capability_digest=$1 AND status_binding_digest=$1 AND status_capability_expires_at>$2
      `, [digest, now])).rows[0])
    },
    async findOperation(id, action) {
      return operationRow((await pool.query(`
        SELECT id,action,status,provider_id,request_id,idempotency_key,request_digest
        FROM giving_provider_operations
        WHERE checkout_id=$1 AND provider='blinkpay' AND action=$2 AND logical_version=1
      `, [id, action])).rows[0])
    },
    completeOneOff(checkout, paymentId, observedAt, providerRequestId) {
      return tx(pool, async (client) => {
        if (!checkout.giverId) throw new GivingCheckoutError('conflict')
        const gift = await client.query(`
          INSERT INTO giving_gifts(
            context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,fund_id,fund_name,fund_code,
            fund_accounting_key,amount_minor,provider_payment_id,status,provider_observed_at,provider_request_id
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'settled',$13,$14)
          ON CONFLICT(checkout_id) DO UPDATE SET
            provider_observed_at=GREATEST(giving_gifts.provider_observed_at,EXCLUDED.provider_observed_at)
          WHERE giving_gifts.context_key=EXCLUDED.context_key
            AND giving_gifts.environment=EXCLUDED.environment
            AND giving_gifts.giver_id=EXCLUDED.giver_id
            AND giving_gifts.fund_id=EXCLUDED.fund_id
            AND giving_gifts.amount_minor=EXCLUDED.amount_minor
            AND giving_gifts.provider_payment_id=EXCLUDED.provider_payment_id
          RETURNING id
        `, [checkout.contextKey,checkout.environment,checkout.synthetic,checkout.e2eRunId,checkout.id,checkout.giverId,checkout.fundId,checkout.fundName,checkout.fundCode,checkout.fundAccountingKey,checkout.amountMinor,paymentId,observedAt,providerRequestId??null])
        if (gift.rowCount !== 1) throw new GivingCheckoutError('conflict')
        const completed = await client.query(`UPDATE giving_checkouts SET status='completed',result_code='verified',updated_at=now() WHERE id=$1 AND context_key=$2 AND status IN ('authorising','verifying','unknown') RETURNING id`, [checkout.id, checkout.contextKey])
        if (completed.rowCount !== 1) throw new GivingCheckoutError('conflict')
      })
    },
    recordConsentAuthorised(checkout, consentId, observedAt, providerRequestId) {
      return tx(pool, async (client) => {
        if (!checkout.giverId) throw new GivingCheckoutError('conflict')
        const result = await client.query(`
          INSERT INTO giving_consents(context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,provider_consent_id,status,provider_observed_at,provider_request_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,'authorised',$8,$9)
          ON CONFLICT(environment,provider_consent_id) DO UPDATE SET
            status='authorised',provider_observed_at=EXCLUDED.provider_observed_at
          WHERE giving_consents.context_key=EXCLUDED.context_key
            AND giving_consents.checkout_id=EXCLUDED.checkout_id
            AND giving_consents.giver_id=EXCLUDED.giver_id
          RETURNING id
        `, [checkout.contextKey,checkout.environment,checkout.synthetic,checkout.e2eRunId,checkout.id,checkout.giverId,consentId,observedAt,providerRequestId??null])
        if (result.rowCount !== 1) throw new GivingCheckoutError('conflict')
        return Number(result.rows[0].id)
      })
    },
    bindScheduleProviderId(checkout, operation, consentId, providerId, providerRequestId) {
      return tx(pool, async (client) => {
        if (!checkout.giverId) throw new GivingCheckoutError('conflict')
        const schedule = await client.query(`
          INSERT INTO giving_schedules(context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)
          ON CONFLICT(consent_id) DO UPDATE SET provider_schedule_id=EXCLUDED.provider_schedule_id
          WHERE giving_schedules.context_key=EXCLUDED.context_key
            AND giving_schedules.checkout_id=EXCLUDED.checkout_id
            AND giving_schedules.giver_id=EXCLUDED.giver_id
            AND giving_schedules.provider_schedule_id=EXCLUDED.provider_schedule_id
          RETURNING id
        `, [checkout.contextKey,checkout.environment,checkout.synthetic,checkout.e2eRunId,checkout.id,checkout.giverId,consentId,providerId,checkout.frequency,checkout.amountMinor])
        if (schedule.rowCount !== 1) throw new GivingCheckoutError('conflict')
        const result = await client.query(`
          WITH updated AS (
            UPDATE giving_provider_operations
            SET status='succeeded',provider_id=$2,provider_request_id=COALESCE($3,provider_request_id),updated_at=now()
            WHERE id=$1 AND checkout_id=$4 AND status='submitted' RETURNING id
          ), next_attempt AS (
            SELECT COALESCE(MAX(attempt_number),0)+1 value FROM giving_provider_operation_attempts WHERE operation_id=$1
          )
          INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id)
          SELECT updated.id,next_attempt.value,'succeeded',$3 FROM updated CROSS JOIN next_attempt RETURNING id
        `, [operation.id,providerId,providerRequestId??null,checkout.id])
        if (result.rowCount !== 1) throw new GivingCheckoutError('conflict')
      })
    },
    completeSchedule(checkout, provider, observedAt) {
      return tx(pool, async (client) => {
        const schedule = await client.query(`
          UPDATE giving_schedules SET status='active',next_payment_date=$2,provider_observed_at=$3,updated_at=now()
          WHERE checkout_id=$1 AND context_key=$4 AND provider_schedule_id=$5 AND status IN ('pending','unknown','active')
          RETURNING id
        `, [checkout.id,provider.next_payment_date,observedAt,checkout.contextKey,provider.fixed_recurring_payment_id])
        if (schedule.rowCount !== 1) throw new GivingCheckoutError('conflict')
        const completed = await client.query(`UPDATE giving_checkouts SET status='completed',result_code='verified',updated_at=now() WHERE id=$1 AND context_key=$2 AND status IN ('authorising','verifying','unknown') RETURNING id`, [checkout.id,checkout.contextKey])
        if (completed.rowCount !== 1) throw new GivingCheckoutError('conflict')
      })
    },
    async setProcessing(id) {
      await pool.query(`
        UPDATE giving_checkouts
        SET status=CASE WHEN status='unknown' THEN status ELSE 'verifying' END,
            result_code=CASE WHEN status='unknown' THEN 'unknown' ELSE 'processing' END,
            updated_at=now()
        WHERE id=$1 AND status NOT IN ('completed','failed')
      `, [id])
    },
    async setFailed(id, code) {
      await pool.query(`
        UPDATE giving_checkouts SET status='failed',result_code=$2,updated_at=now()
        WHERE id=$1 AND status NOT IN ('completed','failed')
      `, [id, code])
    },
  }
}
