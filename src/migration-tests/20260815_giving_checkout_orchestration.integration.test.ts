import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPostgresGivingRateLimitStore } from '../lib/giving/rate-limit'
import { createPostgresGivingLifecycleStore } from '../lib/giving/reconciliation'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository, GivingCheckoutError } from '../lib/giving/service'
import { GIVING_PILOT_UP_SQL } from '../migrations/20260815_170000_giving_pilot'
import { GIVING_CHECKOUT_ORCHESTRATION_UP_SQL } from '../migrations/20260815_230000_giving_checkout_orchestration'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL

function assertDisposable(value: string) {
  const url = new URL(value)
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/giving_pilot_test') {
    throw new Error('GIVING_MIGRATION_TEST_DATABASE_URL must target local database giving_pilot_test')
  }
}

describe.skipIf(!databaseUrl)('giving checkout PostgreSQL concurrency and conflicts', () => {
  let pool: Pool

  beforeAll(() => {
    assertDisposable(databaseUrl!)
    pool = new Pool({ connectionString: databaseUrl, max: 6 })
  })
  afterAll(async () => pool?.end())
  beforeEach(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES;')
    await pool.query(GIVING_PILOT_UP_SQL)
    await pool.query(GIVING_CHECKOUT_ORCHESTRATION_UP_SQL)
    await pool.query("INSERT INTO giving_funds(name,code,accounting_key,is_default) VALUES('General','GEN','general',true)")
  })

  async function seedRun(runId: string) {
    const result = await pool.query<{ id: number }>(`
      INSERT INTO giving_e2e_runs(run_id,context_key,actor_id,token_digest,csrf_digest,expires_at)
      VALUES($1,$2,1,$3,$4,now()+interval '1 hour') RETURNING id
    `, [runId, `sandbox:e2e:${runId}`, `token-${runId}`, `csrf-${runId}`])
    return result.rows[0].id
  }

  function input(runId: string, e2eRunId: number, overrides: { keyDigest?: string; requestDigest?: string; returnDigest?: string } = {}) {
    return {
      contextKey: `sandbox:e2e:${runId}`,
      environment: 'sandbox' as const,
      synthetic: true,
      e2eRunId,
      submission: {
        submissionKey: 'A'.repeat(43), amountMinor: 2500, fundId: 1, frequency: 'one-off' as const,
        firstPaymentDate: null, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', turnstileToken: 'token',
      },
      submissionKeyDigest: overrides.keyDigest ?? `key-${runId}`,
      submissionDigest: overrides.requestDigest ?? 'canonical-request',
      correlationKey: `correlation-${runId}-${overrides.keyDigest ?? 'default'}`,
      returnCapabilityDigest: overrides.returnDigest ?? `return-${runId}`,
      returnCapabilityExpiresAt: new Date(Date.now() + 60_000),
      currentTime: new Date(),
    }
  }

  async function bindGiver(checkoutId: number, runId: string, e2eRunId: number, alias: number) {
    const giver = await pool.query<{ id: number }>(`
      INSERT INTO giving_givers(context_key,environment,synthetic,e2e_run_id,rock_person_alias_id,bank_reference,name,email)
      VALUES($1,'sandbox',true,$2,$3,$4,'Ada','ada@example.com') RETURNING id
    `, [`sandbox:e2e:${runId}`, e2eRunId, alias, `EV${alias}`])
    await pool.query('UPDATE giving_checkouts SET giver_id=$2 WHERE id=$1', [checkoutId, giver.rows[0].id])
    return giver.rows[0].id
  }

  it('isolates key idempotency by context and conflicts on changed canonical body', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run1 = await seedRun('r1')
    const run2 = await seedRun('r2')
    const firstInput = input('r1', run1)
    const concurrent = await Promise.all([repository.createOrReuse(firstInput), repository.createOrReuse(firstInput)])
    expect(new Set(concurrent.map((item) => item.checkout.id)).size).toBe(1)
    expect(concurrent.filter((item) => item.reused)).toHaveLength(1)

    await expect(repository.createOrReuse(input('r1', run1, {
      keyDigest: firstInput.submissionKeyDigest,
      requestDigest: 'changed-request',
      returnDigest: 'changed-return',
    }))).rejects.toBeInstanceOf(GivingCheckoutError)

    const isolated = await repository.createOrReuse(input('r2', run2))
    expect(isolated.checkout.id).not.toBe(concurrent[0].checkout.id)
    expect(isolated.checkout.contextKey).toBe('sandbox:e2e:r2')
  })

  it('rotates return capability only before an operation reaches submitted', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run = await seedRun('rotate')
    const initial = await repository.createOrReuse(input('rotate', run, { returnDigest: 'return-initial' }))
    const rotated = await repository.createOrReuse(input('rotate', run, { returnDigest: 'return-rotated' }))
    expect(rotated.disposition).toBe('start')
    expect((await pool.query('SELECT return_capability_digest FROM giving_checkouts WHERE id=$1', [initial.checkout.id])).rows[0].return_capability_digest).toBe('return-rotated')

    await bindGiver(initial.checkout.id, 'rotate', run, 123)
    const checkout = (await repository.get(initial.checkout.id))!
    const operation = await repository.prepareOperation(checkout, 'blinkpay.create-payment', 'operation-request', {
      requestId: 'request-key-00000001', idempotencyKey: 'idempotency-key-00000001',
    })
    await repository.markSubmitted(operation.id)
    const blocked = await repository.createOrReuse(input('rotate', run, { returnDigest: 'return-must-not-rotate' }))
    expect(blocked.disposition).toBe('recover')
    expect(blocked.checkout.status).toBe('unknown')
    expect((await pool.query('SELECT return_capability_digest FROM giving_checkouts WHERE id=$1', [checkout.id])).rows[0].return_capability_digest).toBe('return-rotated')
  })

  it('keeps a live hosted return capability and recovers instead of rotating after consumption', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run = await seedRun('hosted-reuse')
    const initialInput = input('hosted-reuse', run, { returnDigest: 'return-hosted-original' })
    const created = await repository.createOrReuse(initialInput)
    await bindGiver(created.checkout.id, 'hosted-reuse', run, 125)
    const checkout = (await repository.get(created.checkout.id))!
    const operation = await repository.prepareOperation(checkout, 'blinkpay.create-payment', 'hosted-request', {
      requestId: 'request-key-hosted-0001', idempotencyKey: 'idempotency-hosted-0001',
    })
    await repository.markSubmitted(operation.id)
    await repository.recordHostedSuccess({ checkout, operation, providerId: 'provider-hosted', gatewayRedirectUri: 'https://sandbox.debit.blinkpay.co.nz/gateway/original' })

    const reused = await repository.createOrReuse({ ...initialInput, returnCapabilityDigest: 'return-hosted-retry', currentTime: new Date() })
    expect(reused.disposition).toBe('redirect')
    expect((await pool.query('SELECT return_capability_digest FROM giving_checkouts WHERE id=$1',[checkout.id])).rows[0].return_capability_digest).toBe('return-hosted-original')

    const now = new Date()
    await repository.consumeReturn('return-hosted-original', 'provider-hosted', now, 'status-hosted', 'status-hosted', new Date(now.getTime()+60_000))
    const consumed = await repository.createOrReuse({ ...initialInput, returnCapabilityDigest: 'return-hosted-must-not-rotate', currentTime: new Date() })
    expect(consumed.disposition).toBe('recover')
    expect((await pool.query('SELECT return_capability_digest FROM giving_checkouts WHERE id=$1',[checkout.id])).rows[0].return_capability_digest).toBe('return-hosted-original')

    const expiredRun = await seedRun('hosted-expired')
    const expiredInput = input('hosted-expired', expiredRun, { returnDigest: 'return-hosted-expired-original' })
    const expiredCreated = await repository.createOrReuse(expiredInput)
    await bindGiver(expiredCreated.checkout.id, 'hosted-expired', expiredRun, 128)
    const expiredCheckout = (await repository.get(expiredCreated.checkout.id))!
    const expiredOperation = await repository.prepareOperation(expiredCheckout, 'blinkpay.create-payment', 'hosted-expired-request', { requestId:'request-key-hosted-0002',idempotencyKey:'idempotency-hosted-0002' })
    await repository.markSubmitted(expiredOperation.id)
    await repository.recordHostedSuccess({ checkout:expiredCheckout,operation:expiredOperation,providerId:'provider-hosted-expired',gatewayRedirectUri:'https://sandbox.debit.blinkpay.co.nz/gateway/expired' })
    await pool.query("UPDATE giving_checkouts SET return_capability_expires_at=now()-interval '1 second' WHERE id=$1",[expiredCheckout.id])
    const expired = await repository.createOrReuse({ ...expiredInput,returnCapabilityDigest:'return-hosted-expired-must-not-rotate',currentTime:new Date() })
    expect(expired.disposition).toBe('recover')
    expect((await pool.query('SELECT return_capability_digest FROM giving_checkouts WHERE id=$1',[expiredCheckout.id])).rows[0].return_capability_digest).toBe('return-hosted-expired-original')
  })

  it('persists an accepted unknown provider ID and exposes it to authoritative reconciliation', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run = await seedRun('accepted-unknown')
    const created = await repository.createOrReuse(input('accepted-unknown', run))
    await bindGiver(created.checkout.id, 'accepted-unknown', run, 126)
    const checkout = (await repository.get(created.checkout.id))!
    const operation = await repository.prepareOperation(checkout, 'blinkpay.create-payment', 'accepted-request', {
      requestId: 'request-key-accepted-0001', idempotencyKey: 'idempotency-accepted-0001',
    })
    await repository.markSubmitted(operation.id)
    await repository.recordAcceptedUnknown({ checkoutId: checkout.id, operationId: operation.id, action: operation.action, providerId: 'provider-accepted', providerRequestId: 'provider-request-accepted', code: 'provider-accepted-binding-failed' })
    expect((await pool.query('SELECT status,provider_id,provider_request_id FROM giving_provider_operations WHERE id=$1',[operation.id])).rows[0]).toMatchObject({ status:'unknown',provider_id:'provider-accepted',provider_request_id:'provider-request-accepted' })
    expect(await createPostgresGivingLifecycleStore(pool).nonterminalCheckoutIdsWithProviderIds()).toContain(checkout.id)
  })

  it('preserves terminal consent state and newer observations against stale Authorised reads', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run = await seedRun('consent-order')
    const created = await repository.createOrReuse(input('consent-order', run))
    const giverId = await bindGiver(created.checkout.id, 'consent-order', run, 127)
    const checkout = (await repository.get(created.checkout.id))!
    const newer = new Date('2026-08-15T12:00:00Z')
    await pool.query(`INSERT INTO giving_consents(context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,provider_consent_id,status,provider_observed_at,provider_request_id) VALUES($1,'sandbox',true,$2,$3,$4,'consent-terminal','failed',$5,'newer-request')`,[checkout.contextKey,run,checkout.id,giverId,newer])
    const id = await repository.recordConsentAuthorised(checkout,'consent-terminal',new Date('2026-08-15T11:00:00Z'),'stale-request')
    expect(id).toBeNull()
    expect((await pool.query("SELECT status,provider_observed_at,provider_request_id FROM giving_consents WHERE provider_consent_id='consent-terminal'")).rows[0]).toMatchObject({ status:'failed',provider_observed_at:newer,provider_request_id:'newer-request' })
  })

  it('validates a returned provider alias before consuming the capability', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run = await seedRun('alias')
    const created = await repository.createOrReuse(input('alias', run))
    await bindGiver(created.checkout.id, 'alias', run, 124)
    const checkout = (await repository.get(created.checkout.id))!
    const operation = await repository.prepareOperation(checkout, 'blinkpay.create-payment', 'alias-request', {
      requestId: 'request-key-00000003', idempotencyKey: 'idempotency-key-00000003',
    })
    await repository.markSubmitted(operation.id)
    await pool.query("UPDATE giving_provider_operations SET status='succeeded',provider_id='provider-expected' WHERE id=$1", [operation.id])
    const now = new Date()
    const wrong = await repository.consumeReturn('return-alias', 'provider-wrong', now, 'status-wrong', 'status-wrong', new Date(now.getTime() + 60_000))
    expect(wrong).toBeNull()
    expect((await pool.query('SELECT return_capability_consumed_at FROM giving_checkouts WHERE id=$1', [checkout.id])).rows[0].return_capability_consumed_at).toBeNull()
    const matched = await repository.consumeReturn('return-alias', 'provider-expected', now, 'status-right', 'status-right', new Date(now.getTime() + 60_000))
    expect(matched?.id).toBe(checkout.id)
  })

  it('rejects conflicting gift and schedule rows without completing the checkout', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run = await seedRun('aggregate')
    const created = await repository.createOrReuse(input('aggregate', run))
    const giverId = await bindGiver(created.checkout.id, 'aggregate', run, 321)
    await pool.query("UPDATE giving_checkouts SET status='verifying' WHERE id=$1", [created.checkout.id])
    const checkout = (await repository.get(created.checkout.id))!

    await pool.query(`
      INSERT INTO giving_gifts(context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,provider_payment_id,status)
      VALUES($1,'sandbox',true,$2,$3,$4,1,'General','GEN','general',2500,'payment-existing','settled')
    `, [checkout.contextKey, run, checkout.id, giverId])
    await expect(repository.completeOneOff(checkout, 'payment-different', new Date())).rejects.toBeInstanceOf(GivingCheckoutError)
    expect((await repository.get(checkout.id))?.status).toBe('verifying')

    const consent = await pool.query<{ id: number }>(`
      INSERT INTO giving_consents(context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,provider_consent_id,status)
      VALUES($1,'sandbox',true,$2,$3,$4,'consent-existing','authorised') RETURNING id
    `, [checkout.contextKey, run, checkout.id, giverId])
    const other = await repository.createOrReuse(input('aggregate', run, {
      keyDigest: 'key-aggregate-other', requestDigest: 'canonical-other', returnDigest: 'return-other',
    }))
    await bindGiver(other.checkout.id, 'aggregate', run, 322)
    const otherCheckout = (await repository.get(other.checkout.id))!
    await expect(repository.recordConsentAuthorised(otherCheckout, 'consent-existing', new Date())).rejects.toBeInstanceOf(GivingCheckoutError)
    expect((await repository.get(otherCheckout.id))?.status).toBe('draft')
    await pool.query(`
      INSERT INTO giving_schedules(context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor)
      VALUES($1,'sandbox',true,$2,$3,$4,$5,'schedule-existing','pending','monthly',2500)
    `, [checkout.contextKey, run, checkout.id, giverId, consent.rows[0].id])
    const scheduleOperation = await repository.prepareOperation(checkout, 'blinkpay.create-schedule', 'schedule-request', {
      requestId: 'request-key-00000002', idempotencyKey: 'idempotency-key-00000002',
    })
    await repository.markSubmitted(scheduleOperation.id)
    await expect(repository.bindScheduleProviderId(checkout, scheduleOperation, consent.rows[0].id, 'schedule-different')).rejects.toBeInstanceOf(GivingCheckoutError)
    expect((await repository.findOperation(checkout.id, 'blinkpay.create-schedule'))?.status).toBe('submitted')
    await expect(repository.completeSchedule(checkout, { ...scheduleOperation, status: 'unknown', providerId: 'schedule-missing' }, consent.rows[0].id, {
      fixed_recurring_payment_id: 'schedule-missing', consent_id: 'consent-existing', status: 'active',
      start_date: '2026-09-01', next_payment_date: '2026-09-01', amount: { total: '25.00', currency: 'NZD' },
      pcr: { particulars: 'GEN', reference: 'EV321' }, retry_strategy: 'same_day', creation_timestamp: new Date().toISOString(),
    }, new Date())).rejects.toBeInstanceOf(GivingCheckoutError)
    expect((await repository.get(checkout.id))?.status).toBe('verifying')
  })

  it('recovers a provider-accepted schedule after local binding failed without creating it again', async () => {
    const repository = createPostgresGivingCheckoutRepository(pool)
    const run = await seedRun('schedule-recovery')
    const created = await repository.createOrReuse(input('schedule-recovery', run))
    await bindGiver(created.checkout.id, 'schedule-recovery', run, 323)
    await pool.query("UPDATE giving_checkouts SET frequency='monthly',first_payment_date='2026-09-01',status='unknown',result_code='unknown' WHERE id=$1", [created.checkout.id])
    const checkout = (await repository.get(created.checkout.id))!
    const consentProviderId = '22222222-2222-4222-8222-222222222223'
    const consent = await repository.recordConsentAuthorised(checkout, consentProviderId, new Date('2026-08-15T00:00:00Z'))
    const scheduleRequestDigest = createHash('sha256').update(JSON.stringify({ action:'blinkpay.create-schedule',checkoutId:checkout.id,contextKey:checkout.contextKey,amountMinor:checkout.amountMinor,frequency:checkout.frequency,firstPaymentDate:checkout.firstPaymentDate,fundCode:checkout.fundCode,bankReference:checkout.bankReference })).digest('hex')
    const operation = await repository.prepareOperation(checkout, 'blinkpay.create-schedule', scheduleRequestDigest, {
      requestId: 'request-key-recovery-0001', idempotencyKey: 'idempotency-recovery-0001',
    })
    await repository.markSubmitted(operation.id)
    const providerScheduleId = '33333333-3333-4333-8333-333333333334'
    await repository.recordAcceptedUnknown({ checkoutId:checkout.id,operationId:operation.id,action:'blinkpay.create-schedule',providerId:providerScheduleId,code:'provider-accepted-binding-failed' })
    expect((await pool.query('SELECT count(*) count FROM giving_schedules WHERE checkout_id=$1',[checkout.id])).rows[0].count).toBe('0')

    const createFixedRecurringPayment = vi.fn()
    const getFixedRecurringPayment = vi.fn().mockResolvedValue({
      fixed_recurring_payment_id: providerScheduleId, consent_id: consentProviderId, status: 'active',
      start_date: '2026-09-01', next_payment_date: '2026-09-01', amount: { total: '25.00', currency: 'NZD' },
      pcr: { particulars: 'GEN', reference: 'EV323' }, retry_strategy: 'same_day', creation_timestamp: '2026-08-15T00:00:00Z',
    })
    const service = createGivingCheckoutService({
      repository,
      blinkPay: {
        getEnduringConsent: vi.fn().mockResolvedValue({ consent_id:consentProviderId,status:'Authorised',status_updated_timestamp:'2026-08-15T00:00:00Z' }),
        getFixedRecurringPayment, createFixedRecurringPayment,
        isConsentAuthorised: () => true, isFixedRecurringPaymentActive: () => true,
      } as never,
      resolveIdentity: vi.fn(), digestSecret: 's'.repeat(32), now: () => new Date('2026-08-15T00:01:00Z'),
    })
    expect(checkout).toMatchObject({ firstPaymentDate:'2026-09-01',amountMinor:2500,frequency:'monthly' })
    expect(await repository.findOperation(checkout.id,'blinkpay.create-schedule')).toMatchObject({ providerId:providerScheduleId,status:'unknown' })
    await service.continueRecurring(checkout, consentProviderId)

    expect(createFixedRecurringPayment).not.toHaveBeenCalled()
    expect(getFixedRecurringPayment).toHaveBeenCalledWith(providerScheduleId)
    expect((await pool.query(`SELECT context_key,environment,synthetic,e2e_run_id,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor
      FROM giving_schedules WHERE checkout_id=$1`,[checkout.id])).rows).toEqual([{
      context_key:checkout.contextKey,environment:'sandbox',synthetic:true,e2e_run_id:run,checkout_id:checkout.id,giver_id:checkout.giverId,
      consent_id:consent,provider_schedule_id:providerScheduleId,status:'active',frequency:'monthly',amount_minor:'2500',
    }])
    expect((await repository.findOperation(checkout.id,'blinkpay.create-schedule'))?.status).toBe('succeeded')
    expect((await repository.get(checkout.id))?.status).toBe('completed')
  })

  it('increments layered rate-limit buckets atomically across connections', async () => {
    const store = createPostgresGivingRateLimitStore(pool)
    const rateInput = {
      bucketDigest: 'bucket', scope: 'client' as const,
      windowStartedAt: new Date('2026-08-15T00:00:00Z'), expiresAt: new Date('2026-08-15T00:20:00Z'),
    }
    const counts = await Promise.all([store.increment(rateInput), store.increment(rateInput)])
    expect(counts.sort()).toEqual([1, 2])
  })
})
