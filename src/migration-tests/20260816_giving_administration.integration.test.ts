import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGivingCancellationService, createPostgresGivingCancellationStore } from '../lib/giving/cancellation'
import { createPostgresGivingLifecycleStore, createUnknownCancellationReconciler } from '../lib/giving/reconciliation'
import { GIVING_PILOT_DOWN_SQL, GIVING_PILOT_UP_SQL } from '../migrations/20260815_170000_giving_pilot'
import { GIVING_DRAFTS_DOWN_SQL, GIVING_DRAFTS_UP_SQL } from '../migrations/20260815_210000_giving_drafts'
import { GIVING_CHECKOUT_ORCHESTRATION_DOWN_SQL, GIVING_CHECKOUT_ORCHESTRATION_UP_SQL } from '../migrations/20260815_230000_giving_checkout_orchestration'
import { GIVING_WEBHOOK_JOBS_DOWN_SQL, GIVING_WEBHOOK_JOBS_UP_SQL } from '../migrations/20260816_000000_giving_webhook_jobs'
import { GIVING_ADMINISTRATION_DOWN_SQL, GIVING_ADMINISTRATION_UP_SQL } from '../migrations/20260816_010000_giving_administration'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL
function assertDisposable(value: string) {
  const url = new URL(value)
  if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/giving_pilot_test') throw new Error('GIVING_MIGRATION_TEST_DATABASE_URL must target local database giving_pilot_test')
}

describe.skipIf(!databaseUrl)('giving administration PostgreSQL concurrency', () => {
  let pool: Pool
  beforeAll(() => { assertDisposable(databaseUrl!); pool = new Pool({ connectionString:databaseUrl,max:6 }) })
  afterAll(async()=>pool?.end())
  beforeEach(async()=>{
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TYPE enum_payload_jobs_log_task_slug AS ENUM('inline'); CREATE TYPE enum_payload_jobs_task_slug AS ENUM('inline'); CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES;")
    await pool.query(GIVING_PILOT_UP_SQL);await pool.query(GIVING_CHECKOUT_ORCHESTRATION_UP_SQL);await pool.query(GIVING_WEBHOOK_JOBS_UP_SQL);await pool.query(GIVING_ADMINISTRATION_UP_SQL)
  })

  it('seeds General only on an empty fund table and never replaces an existing configured default', async () => {
    expect((await pool.query('SELECT name,code,active,is_default FROM giving_funds')).rows).toEqual([{name:'General',code:'GEN',active:true,is_default:true}])
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES;')
    await pool.query(GIVING_PILOT_UP_SQL)
    await pool.query("INSERT INTO giving_funds(name,code,accounting_key,is_default) VALUES('Missions','MIS','missions',true)")
    await pool.query(GIVING_ADMINISTRATION_UP_SQL)
    expect((await pool.query('SELECT name,code,is_default FROM giving_funds')).rows).toEqual([{name:'Missions',code:'MIS',is_default:true}])
  })

  it('rolls the pristine full giving chain down after removing only its exact seed', async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TYPE enum_payload_jobs_log_task_slug AS ENUM(\'inline\'); CREATE TYPE enum_payload_jobs_task_slug AS ENUM(\'inline\'); CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY);')
    await pool.query(GIVING_PILOT_UP_SQL)
    await pool.query(GIVING_DRAFTS_UP_SQL)
    await pool.query(GIVING_CHECKOUT_ORCHESTRATION_UP_SQL)
    await pool.query(GIVING_WEBHOOK_JOBS_UP_SQL)
    await pool.query(GIVING_ADMINISTRATION_UP_SQL)
    expect((await pool.query("SELECT code FROM giving_funds")).rows).toEqual([{code:'GEN'}])
    await pool.query(GIVING_ADMINISTRATION_DOWN_SQL)
    await pool.query(GIVING_WEBHOOK_JOBS_DOWN_SQL)
    await pool.query(GIVING_CHECKOUT_ORCHESTRATION_DOWN_SQL)
    await pool.query(GIVING_DRAFTS_DOWN_SQL)
    await pool.query(GIVING_PILOT_DOWN_SQL)
    expect((await pool.query("SELECT to_regclass('giving_funds') name")).rows[0].name).toBeNull()
  })

  it('rejects cancellation schedule provenance from a different checkout', async () => {
    const giver=(await pool.query("INSERT INTO giving_givers(context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) VALUES('production','production',false,10,'EV10','Ada','ada@example.com') RETURNING id")).rows[0]
    const first=(await pool.query("INSERT INTO giving_checkouts(context_key,environment,synthetic,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,frequency,correlation_key,status,submission_key_digest,submission_digest) VALUES('production','production',false,$1,1,'General','GEN','general',2500,'monthly','first-correlation','completed','first-key','first-digest') RETURNING id",[giver.id])).rows[0]
    const second=(await pool.query("INSERT INTO giving_checkouts(context_key,environment,synthetic,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,frequency,correlation_key,status,submission_key_digest,submission_digest) VALUES('production','production',false,$1,1,'General','GEN','general',2500,'monthly','second-correlation','completed','second-key','second-digest') RETURNING id",[giver.id])).rows[0]
    const consent=(await pool.query("INSERT INTO giving_consents(context_key,environment,synthetic,checkout_id,giver_id,provider_consent_id,status) VALUES('production','production',false,$1,$2,'provenance-consent','authorised') RETURNING id",[first.id,giver.id])).rows[0]
    const schedule=(await pool.query("INSERT INTO giving_schedules(context_key,environment,synthetic,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor) VALUES('production','production',false,$1,$2,$3,'provenance-schedule','active','monthly',2500) RETURNING id",[first.id,giver.id,consent.id])).rows[0]
    await expect(pool.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,schedule_id,actor_id,reason,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status)
      VALUES('production','production',false,$1,$2,1,'Donor request','blinkpay','blinkpay.cancel-schedule',1,'mismatch-digest','mismatch-correlation','mismatch-request','mismatch-idempotency','submitted')`,[second.id,schedule.id])).rejects.toMatchObject({code:'23503'})
  })

  it('serializes concurrent default swaps and retains exactly one active default', async () => {
    await pool.query("INSERT INTO giving_funds(name,code,accounting_key) VALUES('Missions','MIS','missions'),('Buildings','BLD','buildings')")
    async function swap(code:string) {
      const client=await pool.connect();try{await client.query('BEGIN');await client.query('UPDATE giving_funds SET is_default=false WHERE active AND is_default');await client.query('UPDATE giving_funds SET is_default=true WHERE code=$1',[code]);await client.query('COMMIT')}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
    }
    await Promise.all([swap('MIS'),swap('BLD')])
    const defaults = (await pool.query('SELECT code FROM giving_funds WHERE active AND is_default')).rows
    expect(defaults).toHaveLength(1)
    expect(['MIS','BLD']).toContain(defaults[0].code)
  })

  it('consumes a nonce once and serializes two admins before one provider DELETE', async () => {
    const giver=(await pool.query("INSERT INTO giving_givers(context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) VALUES('production','production',false,10,'EV10','Ada','ada@example.com') RETURNING id")).rows[0]
    const checkout=(await pool.query("INSERT INTO giving_checkouts(context_key,environment,synthetic,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,frequency,correlation_key,status,submission_key_digest,submission_digest) VALUES('production','production',false,$1,1,'General','GEN','general',2500,'monthly','cancel-correlation','completed','cancel-key','cancel-digest') RETURNING id",[giver.id])).rows[0]
    const consent=(await pool.query("INSERT INTO giving_consents(context_key,environment,synthetic,checkout_id,giver_id,provider_consent_id,status) VALUES('production','production',false,$1,$2,'22222222-2222-4222-8222-222222222222','authorised') RETURNING id",[checkout.id,giver.id])).rows[0]
    const schedule=(await pool.query("INSERT INTO giving_schedules(context_key,environment,synthetic,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor) VALUES('production','production',false,$1,$2,$3,'33333333-3333-4333-8333-333333333333','active','monthly',2500) RETURNING id",[checkout.id,giver.id,consent.id])).rows[0]
    await pool.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status,provider_id) VALUES('production','production',false,$1,'blinkpay','blinkpay.create-schedule',1,'create-digest','create-correlation','create-request-0001','create-idempotency-0001','succeeded','33333333-3333-4333-8333-333333333333')`,[checkout.id])
    const cancelFixedRecurringPayment=vi.fn(async()=>{
      await pool.query("UPDATE giving_schedules SET status='cancelled',provider_source='webhook' WHERE id=$1",[schedule.id])
      return {outcome:'succeeded',value:undefined,metadata:{requestId:'request-key-00000001',idempotencyKey:'idempotency-key-00000001'}} as const
    })
    let token=0
    const service=createGivingCancellationService({store:createPostgresGivingCancellationStore(pool),provider:()=>({cancelFixedRecurringPayment,getFixedRecurringPayment:vi.fn()}),randomToken:()=>`${++token}`.padEnd(43,'N'),randomId:()=>crypto.randomUUID()})
    const [first,second]=await Promise.all([service.prepare({actorId:1,scheduleId:schedule.id,reason:'Donor request'}),service.prepare({actorId:2,scheduleId:schedule.id,reason:'Donor request'})])
    const outcomes=await Promise.allSettled([service.confirm({actorId:1,scheduleId:schedule.id,reason:'Donor request',nonce:first.nonce}),service.confirm({actorId:2,scheduleId:schedule.id,reason:'Donor request',nonce:second.nonce})])
    expect(outcomes.filter((item)=>item.status==='fulfilled'), outcomes.map((item)=>item.status==='rejected' ? JSON.stringify(item.reason,Object.getOwnPropertyNames(item.reason)) : item.value.status).join(' | ')).toHaveLength(1)
    expect(cancelFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect((await pool.query('SELECT status,provider_source FROM giving_schedules WHERE id=$1',[schedule.id])).rows[0]).toEqual({status:'cancelled',provider_source:'cancellation'})
    expect((await pool.query("SELECT actor_id,schedule_id,reason,status,provider_id FROM giving_provider_operations WHERE action='blinkpay.cancel-schedule'")).rows).toEqual([expect.objectContaining({actor_id:expect.any(Number),schedule_id:schedule.id,reason:'Donor request',status:'succeeded',provider_id:null})])
    expect((await pool.query("SELECT provider_id FROM giving_provider_operations WHERE action='blinkpay.create-schedule'")).rows[0].provider_id).toBe('33333333-3333-4333-8333-333333333333')
    expect((await pool.query('SELECT status FROM giving_consents WHERE id=$1',[consent.id])).rows[0].status).toBe('authorised')
    await expect(service.confirm({actorId:1,scheduleId:schedule.id,reason:'Donor request',nonce:first.nonce})).rejects.toThrow(/confirmation-invalid|not-active/)
  })

  it('reconciles unknown cancellation operations by GET only and leaves active observations unknown', async () => {
    const giver=(await pool.query("INSERT INTO giving_givers(context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) VALUES('production','production',false,10,'EV10','Ada','ada@example.com') RETURNING id")).rows[0]
    const checkout=(await pool.query("INSERT INTO giving_checkouts(context_key,environment,synthetic,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,frequency,correlation_key,status,submission_key_digest,submission_digest) VALUES('production','production',false,$1,1,'General','GEN','general',2500,'monthly','unknown-correlation','completed','unknown-key','unknown-digest') RETURNING id",[giver.id])).rows[0]
    const consent=(await pool.query("INSERT INTO giving_consents(context_key,environment,synthetic,checkout_id,giver_id,provider_consent_id,status) VALUES('production','production',false,$1,$2,'22222222-2222-4222-8222-222222222222','authorised') RETURNING id",[checkout.id,giver.id])).rows[0]
    const schedule=(await pool.query("INSERT INTO giving_schedules(context_key,environment,synthetic,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor) VALUES('production','production',false,$1,$2,$3,'33333333-3333-4333-8333-333333333333','unknown','monthly',2500) RETURNING id",[checkout.id,giver.id,consent.id])).rows[0]
    const operation=(await pool.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,schedule_id,actor_id,reason,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status) VALUES('production','production',false,$1,$2,1,'Donor request','blinkpay','blinkpay.cancel-schedule',1,'cancel-digest','cancel-correlation','cancel-request-0001','cancel-idempotency-0001','unknown') RETURNING id`,[checkout.id,schedule.id])).rows[0]
    const store=createPostgresGivingLifecycleStore(pool)
    const candidates=await store.unknownCancellationOperations()
    expect(candidates).toEqual([{operationId:operation.id,scheduleId:schedule.id,environment:'production',providerScheduleId:'33333333-3333-4333-8333-333333333333'}])
    const getFixedRecurringPayment=vi.fn().mockResolvedValue({status:'active'})
    const reconcile=createUnknownCancellationReconciler({store,provider:()=>({getFixedRecurringPayment} as never),now:()=>new Date('2026-08-15T12:00:00Z')})
    await reconcile(candidates[0])
    expect(getFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect((await pool.query('SELECT status FROM giving_provider_operations WHERE id=$1',[operation.id])).rows[0].status).toBe('unknown')
    expect((await pool.query('SELECT status,provider_source FROM giving_schedules WHERE id=$1',[schedule.id])).rows[0]).toEqual({status:'unknown',provider_source:'reconciliation'})
    await pool.query("UPDATE giving_schedules SET status='cancelled',provider_source='webhook' WHERE id=$1",[schedule.id])
    await reconcile((await store.unknownCancellationOperations())[0])
    expect(getFixedRecurringPayment).toHaveBeenCalledTimes(2)
    expect((await pool.query('SELECT status,provider_id FROM giving_provider_operations WHERE id=$1',[operation.id])).rows[0]).toEqual({status:'succeeded',provider_id:null})
    expect((await pool.query('SELECT status,provider_source FROM giving_schedules WHERE id=$1',[schedule.id])).rows[0]).toEqual({status:'cancelled',provider_source:'reconciliation'})

    const raced=(await pool.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,schedule_id,actor_id,reason,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status) VALUES('production','production',false,$1,$2,1,'Donor request','blinkpay','blinkpay.cancel-schedule',2,'cancel-digest-2','cancel-correlation-2','cancel-request-0002','cancel-idempotency-0002','submitted') RETURNING id`,[checkout.id,schedule.id])).rows[0]
    const event=await store.recordVerifiedEvent({environment:'production',eventId:'evt-cancel-race',eventType:'schedule.changed',referenceType:'schedule',referenceId:'33333333-3333-4333-8333-333333333333',payloadDigest:'c'.repeat(64),payload:{},now:new Date('2026-08-15T12:01:00Z')})
    const claim=await store.claim(event.eventId,new Date('2026-08-15T12:01:00Z'))
    expect(await store.finalize({eventId:event.eventId,leaseToken:claim!.leaseToken,observation:{referenceType:'schedule',referenceId:'33333333-3333-4333-8333-333333333333',providerStatus:'Cancelled',statusUpdatedAt:new Date('2026-08-15T12:01:00Z'),verifiedAt:new Date('2026-08-15T12:01:00Z')}})).toBe(true)
    expect((await pool.query('SELECT status FROM giving_provider_operations WHERE id=$1',[raced.id])).rows[0].status).toBe('succeeded')
    expect((await pool.query('SELECT outcome FROM giving_provider_operation_attempts WHERE operation_id=$1',[raced.id])).rows).toEqual([{outcome:'succeeded'}])
  })
})
