import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPostgresGivingLifecycleStore } from '../lib/giving/reconciliation'
import { GIVING_PILOT_UP_SQL } from '../migrations/20260815_170000_giving_pilot'
import { GIVING_CHECKOUT_ORCHESTRATION_UP_SQL } from '../migrations/20260815_230000_giving_checkout_orchestration'
import { GIVING_WEBHOOK_JOBS_DOWN_SQL, GIVING_WEBHOOK_JOBS_UP_SQL, GIVING_WEBHOOK_JOB_SLUGS } from '../migrations/20260816_000000_giving_webhook_jobs'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL
function assertDisposable(value: string) {
  const url = new URL(value)
  if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/giving_pilot_test') throw new Error('GIVING_MIGRATION_TEST_DATABASE_URL must target local database giving_pilot_test')
}

describe.skipIf(!databaseUrl)('giving webhook PostgreSQL leases and failure recovery', () => {
  let pool: Pool
  beforeAll(() => { assertDisposable(databaseUrl!); pool = new Pool({ connectionString: databaseUrl, max: 6 }) })
  afterAll(async () => pool?.end())
  beforeEach(async () => {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TYPE enum_payload_jobs_log_task_slug AS ENUM('inline'); CREATE TYPE enum_payload_jobs_task_slug AS ENUM('inline'); CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES;")
    await pool.query(GIVING_PILOT_UP_SQL)
    await pool.query(GIVING_CHECKOUT_ORCHESTRATION_UP_SQL)
    await pool.query(GIVING_WEBHOOK_JOBS_UP_SQL)
    await pool.query("INSERT INTO giving_funds(name,code,accounting_key,is_default) VALUES('General','GEN','general',true)")
  })

  async function seed(paymentId = 'pay-1') {
    const giver = await pool.query<{id:number}>("INSERT INTO giving_givers(context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) VALUES('production','production',false,10,'EV10','Ada','ada@example.com') RETURNING id")
    const checkout = await pool.query<{id:number}>(`INSERT INTO giving_checkouts(context_key,environment,synthetic,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,frequency,correlation_key,status,submission_key_digest,submission_digest) VALUES('production','production',false,$1,1,'General','GEN','general',2500,'monthly',$2,'verifying',$3,$4) RETURNING id`, [giver.rows[0].id,`correlation-${paymentId}`,`key-${paymentId}`,`digest-${paymentId}`])
    const gift = await pool.query<{id:number}>(`INSERT INTO giving_gifts(context_key,environment,synthetic,checkout_id,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,provider_payment_id,status) VALUES('production','production',false,$1,$2,1,'General','GEN','general',2500,$3,'pending') RETURNING id`, [checkout.rows[0].id,giver.rows[0].id,paymentId])
    return { checkoutId: checkout.rows[0].id, giverId: giver.rows[0].id, giftId: gift.rows[0].id }
  }

  it('permits multiple recurring gifts per checkout and enforces lifecycle status and count checks', async () => {
    const seeded = await seed()
    await expect(pool.query(`INSERT INTO giving_gifts(context_key,environment,synthetic,checkout_id,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,provider_payment_id,status) VALUES('production','production',false,$1,$2,1,'General','GEN','general',2500,'pay-2','settled')`, [seeded.checkoutId,seeded.giverId])).resolves.toBeDefined()
    await expect(pool.query("UPDATE giving_gifts SET status='invented' WHERE id=$1", [seeded.giftId])).rejects.toMatchObject({ code: '23514' })
    await expect(pool.query("INSERT INTO blinkpay_webhook_events(context_key,environment,synthetic,provider_event_id,event_type,payload_digest,payload,status,attempt_count) VALUES('production','production',false,'bad-count','x','d','{}','pending',-1)")).rejects.toMatchObject({ code: '23514' })
  })

  it('deduplicates and quarantines digest conflicts while retaining unmatched events without processing them', async () => {
    await seed()
    const store = createPostgresGivingLifecycleStore(pool)
    const input = { environment: 'production' as const, eventId:'evt-1', eventType:'payment.completed', referenceType:'payment' as const, referenceId:'pay-1', payloadDigest:'a'.repeat(64), payload:{ id:'evt-1' }, now:new Date() }
    const results = await Promise.all([store.recordVerifiedEvent(input), store.recordVerifiedEvent(input)])
    expect(results.map((item) => item.outcome).sort()).toEqual(['duplicate','inserted'])
    expect((await store.recordVerifiedEvent({ ...input, payloadDigest:'b'.repeat(64) })).outcome).toBe('conflict')
    expect((await pool.query("SELECT status,duplicate_count,conflict_count,last_conflicting_digest FROM blinkpay_webhook_events WHERE provider_event_id='evt-1'")).rows[0]).toMatchObject({ status:'quarantined', duplicate_count:'1', conflict_count:'1', last_conflicting_digest:'b'.repeat(64) })
    expect((await store.recordVerifiedEvent({ ...input, eventId:'missing-prod', referenceId:'missing' })).outcome).toBe('quarantined')
    expect((await pool.query("SELECT context_key,synthetic,status FROM blinkpay_webhook_events WHERE provider_event_id='missing-prod'")).rows[0]).toMatchObject({ context_key:'production:unmatched',synthetic:false,status:'quarantined' })
    expect((await store.recordVerifiedEvent({ ...input, environment:'sandbox', eventId:'missing-sandbox', referenceId:'missing' })).outcome).toBe('quarantined')
  })

  it('leases conditionally, rejects an old lease and atomically finalizes aggregate plus inbox', async () => {
    await seed()
    const store = createPostgresGivingLifecycleStore(pool)
    const inserted = await store.recordVerifiedEvent({ environment:'production',eventId:'evt-lease',eventType:'payment.completed',referenceType:'payment',referenceId:'pay-1',payloadDigest:'c'.repeat(64),payload:{},now:new Date() })
    const claims = await Promise.all([store.claim(inserted.eventId,new Date()),store.claim(inserted.eventId,new Date())])
    const first = claims.find(Boolean)!
    expect(claims.filter(Boolean)).toHaveLength(1)
    await pool.query("UPDATE blinkpay_webhook_events SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [inserted.eventId])
    const reclaimed = await store.claim(inserted.eventId,new Date())
    expect(reclaimed?.leaseToken).not.toBe(first.leaseToken)
    const observation = { referenceType:'payment' as const,referenceId:'pay-1',providerStatus:'AcceptedSettlementCompleted',statusUpdatedAt:new Date(),verifiedAt:new Date() }
    expect(await store.finalize({ eventId:inserted.eventId,leaseToken:first.leaseToken,observation })).toBe(false)
    expect(await store.finalize({ eventId:inserted.eventId,leaseToken:reclaimed!.leaseToken,observation })).toBe(true)
    expect((await pool.query("SELECT g.status gift_status,e.status event_status FROM giving_gifts g JOIN blinkpay_webhook_events e ON e.id=$1 WHERE g.provider_payment_id='pay-1'",[inserted.eventId])).rows[0]).toMatchObject({ gift_status:'settled',event_status:'processed' })
    const stale = await store.recordVerifiedEvent({ environment:'production',eventId:'evt-stale',eventType:'payment.failed',referenceType:'payment',referenceId:'pay-1',payloadDigest:'e'.repeat(64),payload:{},now:new Date() })
    const staleClaim = await store.claim(stale.eventId,new Date())
    expect(await store.finalize({ eventId:stale.eventId,leaseToken:staleClaim!.leaseToken,observation:{ ...observation,providerStatus:'Failed',statusUpdatedAt:new Date(observation.statusUpdatedAt.getTime()-1000) } })).toBe(true)
    expect((await pool.query("SELECT status FROM giving_gifts WHERE provider_payment_id='pay-1'")).rows[0].status).toBe('settled')
  })

  it('rolls back inbox completion when aggregate finalization fails and retains shared job enums on down', async () => {
    await seed()
    const store = createPostgresGivingLifecycleStore(pool)
    const inserted = await store.recordVerifiedEvent({ environment:'production',eventId:'evt-fail',eventType:'payment.completed',referenceType:'payment',referenceId:'pay-1',payloadDigest:'d'.repeat(64),payload:{},now:new Date() })
    const claim = await store.claim(inserted.eventId,new Date())
    await pool.query("UPDATE blinkpay_webhook_events SET provider_reference_id='missing' WHERE id=$1", [inserted.eventId])
    await expect(store.finalize({ eventId:inserted.eventId,leaseToken:claim!.leaseToken,observation:{ referenceType:'payment',referenceId:'missing',providerStatus:'AcceptedSettlementCompleted',statusUpdatedAt:new Date(),verifiedAt:new Date() } })).rejects.toThrow(/correlation is stale/)
    expect((await pool.query('SELECT status,lease_token FROM blinkpay_webhook_events WHERE id=$1',[inserted.eventId])).rows[0]).toMatchObject({ status:'processing',lease_token:claim!.leaseToken })
    await pool.query("UPDATE blinkpay_webhook_events SET provider_reference_id=NULL,status='quarantined',lease_token=NULL,lease_expires_at=NULL WHERE id=$1",[inserted.eventId])
    await pool.query(GIVING_WEBHOOK_JOBS_DOWN_SQL)
    for (const slug of GIVING_WEBHOOK_JOB_SLUGS) expect((await pool.query('SELECT $1::enum_payload_jobs_task_slug value',[slug])).rows[0].value).toBe(slug)
  })

  it('handles equal-time conflicts, legal terminal transitions and payment cancellation', async () => {
    const seeded = await seed()
    const store = createPostgresGivingLifecycleStore(pool)
    const at = new Date('2026-08-15T12:00:00Z')
    const record = (eventId: string, referenceId = 'pay-1') => store.recordVerifiedEvent({ environment:'production',eventId,eventType:'payment.changed',referenceType:'payment',referenceId,payloadDigest:eventId.padEnd(64,'x'),payload:{},now:at })
    const first = await record('evt-terminal-1')
    const firstClaim = await store.claim(first.eventId,at)
    expect(await store.finalize({ eventId:first.eventId,leaseToken:firstClaim!.leaseToken,observation:{ referenceType:'payment',referenceId:'pay-1',providerStatus:'AcceptedSettlementCompleted',statusUpdatedAt:at,verifiedAt:at } })).toBe(true)
    const equal = await record('evt-terminal-2')
    const equalClaim = await store.claim(equal.eventId,at)
    expect(await store.finalize({ eventId:equal.eventId,leaseToken:equalClaim!.leaseToken,observation:{ referenceType:'payment',referenceId:'pay-1',providerStatus:'AcceptedSettlementCompleted',statusUpdatedAt:at,verifiedAt:at } })).toBe(true)
    expect((await pool.query('SELECT status FROM blinkpay_webhook_events WHERE id=$1',[equal.eventId])).rows[0].status).toBe('processed')
    const conflict = await record('evt-terminal-3')
    const conflictClaim = await store.claim(conflict.eventId,at)
    expect(await store.finalize({ eventId:conflict.eventId,leaseToken:conflictClaim!.leaseToken,observation:{ referenceType:'payment',referenceId:'pay-1',providerStatus:'Failed',statusUpdatedAt:at,verifiedAt:at } })).toBe(true)
    expect((await pool.query('SELECT status,last_error FROM blinkpay_webhook_events WHERE id=$1',[conflict.eventId])).rows[0]).toMatchObject({ status:'quarantined',last_error:'provider-observation-conflict' })
    const newer = await record('evt-terminal-4')
    const newerClaim = await store.claim(newer.eventId,new Date(at.getTime()+1000))
    await store.finalize({ eventId:newer.eventId,leaseToken:newerClaim!.leaseToken,observation:{ referenceType:'payment',referenceId:'pay-1',providerStatus:'Failed',statusUpdatedAt:new Date(at.getTime()+1000),verifiedAt:new Date(at.getTime()+1000) } })
    expect((await pool.query('SELECT status FROM giving_gifts WHERE id=$1',[seeded.giftId])).rows[0].status).toBe('settled')

    await pool.query(`INSERT INTO giving_gifts(context_key,environment,synthetic,checkout_id,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,provider_payment_id,status) VALUES('production','production',false,$1,$2,1,'General','GEN','general',2500,'pay-cancel','pending')`,[seeded.checkoutId,seeded.giverId])
    const cancelled = await record('evt-cancelled','pay-cancel')
    const cancelledClaim = await store.claim(cancelled.eventId,at)
    await store.finalize({ eventId:cancelled.eventId,leaseToken:cancelledClaim!.leaseToken,observation:{ referenceType:'payment',referenceId:'pay-cancel',providerStatus:'Cancelled',statusUpdatedAt:at,verifiedAt:at } })
    expect((await pool.query("SELECT status FROM giving_gifts WHERE provider_payment_id='pay-cancel'")).rows[0].status).toBe('cancelled')
    const cancelledRegression = await record('evt-cancelled-regression','pay-cancel')
    const cancelledRegressionClaim = await store.claim(cancelledRegression.eventId,new Date(at.getTime()+1000))
    await store.finalize({ eventId:cancelledRegression.eventId,leaseToken:cancelledRegressionClaim!.leaseToken,observation:{ referenceType:'payment',referenceId:'pay-cancel',providerStatus:'AcceptedSettlementCompleted',statusUpdatedAt:new Date(at.getTime()+1000),verifiedAt:new Date(at.getTime()+1000) } })
    expect((await pool.query("SELECT status FROM giving_gifts WHERE provider_payment_id='pay-cancel'")).rows[0].status).toBe('cancelled')

    const consent = await pool.query<{id:number}>(`INSERT INTO giving_consents(context_key,environment,synthetic,checkout_id,giver_id,provider_consent_id,status,provider_status,provider_status_updated_at) VALUES('production','production',false,$1,$2,'consent-terminal','failed','Failed',$3) RETURNING id`,[seeded.checkoutId,seeded.giverId,at])
    await pool.query(`INSERT INTO giving_schedules(context_key,environment,synthetic,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor,provider_status,provider_status_updated_at) VALUES('production','production',false,$1,$2,$3,'schedule-terminal','cancelled','monthly',2500,'Cancelled',$4)`,[seeded.checkoutId,seeded.giverId,consent.rows[0].id,at])
    for (const candidate of [
      { eventId:'evt-consent-terminal',eventType:'consent.changed',referenceType:'consent' as const,referenceId:'consent-terminal',providerStatus:'Authorised' },
      { eventId:'evt-schedule-terminal',eventType:'schedule.changed',referenceType:'schedule' as const,referenceId:'schedule-terminal',providerStatus:'active' },
    ]) {
      const event = await store.recordVerifiedEvent({ environment:'production',payloadDigest:candidate.eventId.padEnd(64,'z'),payload:{},now:at,...candidate })
      const lease = await store.claim(event.eventId,new Date(at.getTime()+1000))
      await store.finalize({ eventId:event.eventId,leaseToken:lease!.leaseToken,observation:{ referenceType:candidate.referenceType,referenceId:candidate.referenceId,providerStatus:candidate.providerStatus,statusUpdatedAt:new Date(at.getTime()+1000),verifiedAt:new Date(at.getTime()+1000) } })
    }
    expect((await pool.query("SELECT status FROM giving_consents WHERE provider_consent_id='consent-terminal'")).rows[0].status).toBe('failed')
    expect((await pool.query("SELECT status FROM giving_schedules WHERE provider_schedule_id='schedule-terminal'")).rows[0].status).toBe('cancelled')
  })

  it('marks an expired final-attempt lease dead and only selects nonterminal checkouts with provider IDs', async () => {
    const seeded = await seed()
    const store = createPostgresGivingLifecycleStore(pool)
    const exhausted = await store.recordVerifiedEvent({ environment:'production',eventId:'evt-exhausted',eventType:'payment.changed',referenceType:'payment',referenceId:'pay-1',payloadDigest:'f'.repeat(64),payload:{},now:new Date() })
    const claim = await store.claim(exhausted.eventId,new Date())
    await pool.query("UPDATE blinkpay_webhook_events SET attempt_count=8,lease_expires_at=now()-interval '1 second' WHERE id=$1",[exhausted.eventId])
    expect(await store.recoverableEventIds(new Date())).not.toContain(exhausted.eventId)
    expect((await pool.query('SELECT status,lease_token FROM blinkpay_webhook_events WHERE id=$1',[exhausted.eventId])).rows[0]).toMatchObject({ status:'dead',lease_token:null })

    await pool.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status,provider_id) VALUES('production','production',false,$1,'blinkpay','blinkpay.create-consent',1,'known','known','request-known-0001','idempotency-known-0001','succeeded','consent-known')`,[seeded.checkoutId])
    expect(await store.nonterminalCheckoutIdsWithProviderIds()).toEqual([seeded.checkoutId])
    await pool.query("UPDATE giving_checkouts SET status='completed' WHERE id=$1",[seeded.checkoutId])
    expect(await store.nonterminalCheckoutIdsWithProviderIds()).toEqual([])
    expect(claim).not.toBeNull()
  })
})
