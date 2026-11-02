import { getMemberGiftHistoryPage } from '@/lib/members/giving'
import { GIVING_FINANCIAL_CONTROLS_UP_SQL } from '@/migrations/20261102_010000_giving_financial_controls'
import { applyStripeCardUpdate } from './card-updates'
import { reconcileStripeRefunds } from './refunds'
import { createGivingLifecycleProcessor, createPostgresGivingLifecycleStore } from '../reconciliation'
import { reconcileRecurringGiving } from '../recurring-reconciliation'
import type Stripe from 'stripe'
import { randomBytes } from 'node:crypto'
import { Pool } from 'pg'
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { GIVING_PILOT_UP_SQL } from '@/migrations/20260815_170000_giving_pilot'
import { GIVING_CHECKOUT_ORCHESTRATION_UP_SQL } from '@/migrations/20260815_230000_giving_checkout_orchestration'
import { GIVING_BANK_CODE_UP_SQL } from '@/migrations/20260817_010000_giving_bank_code'
import { GIVING_EMAIL_DELIVERIES_UP_SQL } from '@/migrations/20260822_010000_giving_email_deliveries'
import { GIVING_TRANSACTION_FEES_UP_SQL } from '@/migrations/20260903_010000_giving_transaction_fees'
import { GIVING_WEBHOOK_JOBS_UP_SQL } from '@/migrations/20260816_000000_giving_webhook_jobs'
import { GIVING_ADMINISTRATION_UP_SQL } from '@/migrations/20260816_010000_giving_administration'
import { MEMBER_GIVING_SELF_SERVICE_UP_SQL } from '@/migrations/20260903_010000_member_giving_self_service'
import { STRIPE_GIVING_UP_SQL } from '@/migrations/20261031_010000_stripe_giving'
import { createPostgresGivingCheckoutRepository } from '../service'
import { startStripeGiving, reconcileStripeCheckout } from './service'
import { givingAnchorTimestamp, nextGivingAnchor, nzGivingDate } from './dates'
import { getGivingCancellationProvider } from './cancellation'
import { storeStripeEvent, reconcileStripeGiving } from './lifecycle'
import { givingFinanceCsv } from '../finance-export'

const api=vi.hoisted(()=>({customers:{create:vi.fn()},checkout:{sessions:{create:vi.fn(),retrieve:vi.fn()}},paymentIntents:{retrieve:vi.fn()},charges:{retrieve:vi.fn()},refunds:{list:vi.fn()},setupIntents:{retrieve:vi.fn()},prices:{create:vi.fn(),retrieve:vi.fn()},coupons:{create:vi.fn(),retrieve:vi.fn()},subscriptionSchedules:{update:vi.fn(),list:vi.fn(),create:vi.fn(),retrieve:vi.fn(),cancel:vi.fn()},subscriptions:{update:vi.fn(),retrieve:vi.fn(),list:vi.fn(),cancel:vi.fn()},invoices:{list:vi.fn(),voidInvoice:vi.fn(),del:vi.fn()},invoicePayments:{list:vi.fn()},payouts:{retrieve:vi.fn()},balanceTransactions:{list:vi.fn()}}))
vi.mock('./config',()=>({getGivingStripe:()=>api,loadStripeGivingConfig:()=>({origin:'https://www.ev.church',publishableKey:'pk_test_example'})}))
const url=process.env.GIVING_STRIPE_TEST_DATABASE_URL

describe.skipIf(!url)('Stripe giving against disposable PostgreSQL',()=>{
  let pool:Pool
  beforeAll(()=>{
    const target=new URL(url!)
    if(!['','localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/giving_stripe_test')throw new Error('Tests require local giving_stripe_test')
    pool=new Pool({connectionString:url,max:8})
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET','test-secret-'.repeat(4))
  })
  afterEach(()=>vi.useRealTimers())
  afterAll(async()=>{await pool?.end();vi.unstubAllEnvs()})
  beforeEach(async()=>{
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY)')
    for(const sql of [GIVING_PILOT_UP_SQL,GIVING_CHECKOUT_ORCHESTRATION_UP_SQL,GIVING_BANK_CODE_UP_SQL,GIVING_EMAIL_DELIVERIES_UP_SQL,GIVING_TRANSACTION_FEES_UP_SQL,GIVING_WEBHOOK_JOBS_UP_SQL,GIVING_ADMINISTRATION_UP_SQL,MEMBER_GIVING_SELF_SERVICE_UP_SQL])await pool.query(sql)
    await pool.query(`CREATE TABLE support_profiles(id serial PRIMARY KEY,name varchar,email varchar); ALTER TABLE giving_funds ADD COLUMN support_profile_id integer REFERENCES support_profiles(id);
      ALTER TABLE giving_email_deliveries ADD COLUMN recipient_email varchar, ADD COLUMN recipient_name varchar;
      ALTER TABLE giving_checkouts ADD COLUMN bank_setup_acknowledged_at timestamptz;
      INSERT INTO users DEFAULT VALUES`)
    await pool.query(STRIPE_GIVING_UP_SQL)
    await pool.query(GIVING_FINANCIAL_CONTROLS_UP_SQL)
    vi.resetAllMocks()
    api.refunds.list.mockReturnValue([])
  })
  const context={contextKey:'sandbox',environment:'sandbox' as const,synthetic:true}
  function submission(){return {submissionKey:randomBytes(32).toString('base64url'),amountMinor:10000,transactionFeeMinor:304,fundId:1,frequency:'one-off' as const,firstPaymentDate:null,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com',turnstileToken:'verified-token'}}
  async function resolveIdentity(input:{checkoutId:number}) {
    const giver=(await pool.query<{id:number}>("INSERT INTO giving_givers(context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) SELECT context_key,environment,synthetic,123,'EV123','Ada Lovelace','ada@example.com' FROM giving_checkouts WHERE id=$1 ON CONFLICT(context_key,rock_person_alias_id) DO UPDATE SET name=EXCLUDED.name RETURNING id",[input.checkoutId])).rows[0]
    await pool.query('UPDATE giving_checkouts SET giver_id=$2 WHERE id=$1',[input.checkoutId,giver.id])
    return {giverId:giver.id,personAliasId:123,bankReference:'EV123',firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}
  }
  function mockCheckout(){
    api.customers.create.mockResolvedValue({id:'cus_test'})
    api.checkout.sessions.create.mockImplementation(async(params)=>({id:'cs_test',client_secret:'cs_test_secret_example',livemode:false,currency:'nzd',...params}))
  }
  it('runs the migration without modifying historical BlinkPay fees or consent links',async()=>{
    expect((await pool.query("SELECT is_nullable FROM information_schema.columns WHERE table_name='giving_schedules' AND column_name='consent_id'")).rows[0].is_nullable).toBe('YES')
    expect((await pool.query("SELECT column_default FROM information_schema.columns WHERE table_name='giving_gifts' AND column_name='payment_provider'")).rows[0].column_default).toContain('blinkpay')
    expect((await pool.query("SELECT column_default FROM information_schema.columns WHERE table_name='giving_settings' AND column_name='card_percentage_basis_points'")).rows[0].column_default).toBe('250')
  })
  it('creates a card checkout once and blocks cross-gateway reuse of its submission key',async()=>{
    mockCheckout()
    const value=submission()
    const first=await startStripeGiving({...context,submission:value},{pool,resolveIdentity})
    const second=await startStripeGiving({...context,submission:value},{pool,resolveIdentity})
    expect(first.outcome).toBe('embedded');expect(second.outcome).toBe('embedded')
    expect(api.customers.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ ev_giving: 'v1' }) }), expect.anything())
    expect(api.checkout.sessions.create).toHaveBeenCalledTimes(1)
    const existing=(await pool.query('SELECT * FROM giving_checkouts')).rows[0]
    await expect(createPostgresGivingCheckoutRepository(pool).createOrReuse({...context,submission:value,submissionKeyDigest:existing.submission_key_digest,submissionDigest:'different-provider',correlationKey:'other',returnCapabilityDigest:'other',returnCapabilityExpiresAt:new Date(Date.now()+10000),currentTime:new Date()})).rejects.toMatchObject({code:'conflict'})
  })
  it('uses one provider checkout and the same status capability for concurrent duplicate submissions',async()=>{
    mockCheckout()
    const value=submission()
    const results=await Promise.all([startStripeGiving({...context,submission:value},{pool,resolveIdentity}),startStripeGiving({...context,submission:value},{pool,resolveIdentity})])
    expect(api.checkout.sessions.create).toHaveBeenCalledTimes(1)
    expect(results[0].statusToken).toBe(results[1].statusToken)
    expect((await pool.query('SELECT * FROM giving_checkouts')).rows).toHaveLength(1)
  })
  it('records a verified charge and completion once despite duplicate observations',async()=>{
    mockCheckout()
    await startStripeGiving({...context,submission:submission()},{pool,resolveIdentity})
    const stored=(await pool.query('SELECT * FROM giving_checkouts')).rows[0]
    const params=api.checkout.sessions.create.mock.calls[0][0]
    api.checkout.sessions.retrieve.mockResolvedValue({...params,id:'cs_test',livemode:false,currency:'nzd',status:'complete',payment_status:'paid',amount_total:10304,payment_intent:'pi_test'})
    api.paymentIntents.retrieve.mockResolvedValue({id:'pi_test',status:'succeeded',metadata:params.metadata,latest_charge:'ch_test'})
    api.charges.retrieve.mockResolvedValue({id:'ch_test',customer:'cus_test',currency:'nzd',amount:10304,amount_refunded:0,livemode:false,paid:true,status:'succeeded',payment_intent:'pi_test',created:Math.floor(Date.now()/1000),balance_transaction:{currency:'nzd',fee:304,net:10000},disputed:false})
    await reconcileStripeCheckout(pool,stored.id)
    await pool.query("INSERT INTO support_profiles(name,email) VALUES('Sample Support','support@example.com'); UPDATE giving_funds SET support_profile_id=1 WHERE id=1")
    await reconcileStripeCheckout(pool,stored.id)
    expect((await pool.query('SELECT * FROM giving_gifts')).rows).toHaveLength(1)
    expect((await pool.query('SELECT kind FROM giving_email_deliveries')).rows).toEqual([{kind:'stripe-thanks'}])
    expect((await pool.query('SELECT status FROM giving_checkouts')).rows[0].status).toBe('completed')
    const csv=await givingFinanceCsv(pool,'2026-01-01','2026-12-31')
    expect(csv).not.toContain('Ada') // synthetic data never enters finance totals
  })

  async function recurringCheckout() {
    mockCheckout()
    const value={...submission(),frequency:'monthly' as const,firstPaymentDate:new Date(Date.now()+7*86400_000).toISOString().slice(0,10)}
    await startStripeGiving({...context,submission:value},{pool,resolveIdentity})
    const row=(await pool.query('SELECT * FROM giving_checkouts')).rows[0]
    const params=api.checkout.sessions.create.mock.calls[0][0]
    api.checkout.sessions.retrieve.mockResolvedValue({...params,id:'cs_test',status:'complete',livemode:false,currency:'nzd',setup_intent:'seti_test'})
    api.setupIntents.retrieve.mockResolvedValue({id:'seti_test',status:'succeeded',customer:'cus_test',metadata:params.metadata,payment_method:'pm_test'})
    const schedule={id:'sub_sched_test',metadata:params.metadata,livemode:false,customer:'cus_test',status:'not_started',subscription:null as string|null,released_subscription:null,phases:[{items:[{price:'price_test',quantity:1}]}]}
    api.subscriptionSchedules.list.mockResolvedValue({data:[],has_more:false})
    api.subscriptionSchedules.create.mockResolvedValue(schedule)
    api.subscriptionSchedules.retrieve.mockResolvedValue(schedule)
    api.subscriptions.list.mockResolvedValue({data:[],has_more:false})
    api.prices.create.mockResolvedValue({id:'price_test'})
    api.prices.retrieve.mockResolvedValue({currency:'nzd',unit_amount:10304,recurring:{interval:'month',interval_count:1}})
    return {row,value,schedule,metadata:params.metadata}
  }
  it.each([9,18])('charges Today immediately at %s:00 NZ and removes the already-paid period before the next collection',async(hour)=>{
    const today=nzGivingDate()
    const anchor=givingAnchorTimestamp(today)
    vi.setSystemTime(new Date((anchor+(hour-15)*3600)*1000))
    mockCheckout()
    const value={...submission(),frequency:'monthly' as const,firstPaymentDate:today}
    await startStripeGiving({...context,submission:value},{pool,resolveIdentity})
    const row=(await pool.query('SELECT * FROM giving_checkouts')).rows[0]
    const params=api.checkout.sessions.create.mock.calls[0][0]
    expect(params).toMatchObject({mode:'payment',payment_intent_data:{setup_future_usage:'off_session'}})
    api.checkout.sessions.retrieve.mockResolvedValue({...params,id:'cs_test',livemode:false,currency:'nzd',status:'complete',payment_status:'paid',amount_total:10304,payment_intent:'pi_first'})
    api.paymentIntents.retrieve.mockResolvedValue({id:'pi_first',status:'succeeded',setup_future_usage:'off_session',customer:'cus_test',payment_method:'pm_test',metadata:params.metadata,latest_charge:'ch_first'})
    api.charges.retrieve.mockResolvedValue({id:'ch_first',customer:'cus_test',currency:'nzd',amount:10304,amount_refunded:0,livemode:false,paid:true,status:'succeeded',payment_intent:'pi_first',created:Math.floor(Date.now()/1000),balance_transaction:{currency:'nzd',fee:304,net:10000},disputed:false})
    api.prices.create.mockResolvedValue({id:'price_test'})
    api.prices.retrieve.mockResolvedValue({currency:'nzd',unit_amount:10304,recurring:{interval:'month',interval_count:1}})
    api.coupons.create.mockImplementation(async(input)=>({id:'coupon_first',...input}))
    api.coupons.retrieve.mockImplementation(async()=>({id:'coupon_first',percent_off:100,duration:'forever',metadata:{ev_checkout_version:row.submission_digest}}))
    api.subscriptionSchedules.list.mockResolvedValue({data:[],has_more:false})
    const schedule={id:'sub_sched_test',customer:'cus_test',livemode:false,metadata:params.metadata,status:'not_started',subscription:null,released_subscription:null,phases:[
      {start_date:anchor,end_date:nextGivingAnchor(anchor,'monthly'),items:[{price:'price_test',quantity:1}],discounts:[{coupon:'coupon_first'}],billing_cycle_anchor:'automatic'},
      {start_date:nextGivingAnchor(anchor,'monthly'),end_date:nextGivingAnchor(anchor,'monthly',2),items:[{price:'price_test',quantity:1}],discounts:[],billing_cycle_anchor:'automatic'},
    ]}
    api.subscriptionSchedules.create.mockResolvedValue(schedule)
    api.subscriptionSchedules.retrieve.mockResolvedValue(schedule)
    api.coupons.create.mockRejectedValueOnce(new Error('Temporary schedule preparation failure'))
    await expect(reconcileStripeCheckout(pool,row.id)).rejects.toThrow('Temporary schedule preparation failure')
    expect((await pool.query('SELECT amount_minor,schedule_id FROM giving_gifts')).rows).toEqual([{amount_minor:'10000',schedule_id:null}])
    expect((await pool.query('SELECT id FROM giving_schedules')).rows).toHaveLength(0)
    await reconcileStripeCheckout(pool,row.id)
    await reconcileStripeCheckout(pool,row.id)
    expect(api.subscriptionSchedules.create).toHaveBeenCalledTimes(1)
    expect(api.subscriptionSchedules.create.mock.calls[0][0]).toMatchObject({start_date:anchor,phases:[{discounts:[{coupon:'coupon_first'}]},{discounts:'',billing_cycle_anchor:'automatic'}]})
    const gifts=(await pool.query('SELECT amount_minor,transaction_fee_minor,provider_payment_id,schedule_id FROM giving_gifts')).rows
    expect(gifts).toHaveLength(1)
    expect(gifts[0]).toMatchObject({amount_minor:'10000',transaction_fee_minor:'304',provider_payment_id:'pi_first'})
    expect(gifts[0].schedule_id).not.toBeNull()
    const next=(await pool.query('SELECT next_payment_date FROM giving_schedules')).rows[0].next_payment_date as Date
    expect(next.getTime()).toBe(nextGivingAnchor(anchor,'monthly')*1000)
    expect((await pool.query('SELECT status FROM giving_checkouts')).rows[0].status).toBe('completed')
    // A zero subscription invoice represents the already-paid first period, not a second gift.
    const active={...schedule,status:'active',subscription:'sub_test'}
    api.subscriptionSchedules.retrieve.mockResolvedValue(active)
    api.subscriptions.retrieve.mockResolvedValue({metadata:{ev_checkout_version:row.submission_digest},customer:'cus_test',status:'active',items:{data:[{current_period_end:nextGivingAnchor(anchor,'monthly')}]}})
    api.invoices.list.mockReturnValue([{id:'in_free',currency:'nzd',billing_reason:'subscription_create',total:0,amount_paid:0,status:'paid'}])
    await reconcileStripeCheckout(pool,row.id)
    expect((await pool.query('SELECT id FROM giving_gifts')).rows).toHaveLength(1)
    // The next ordinary invoice is paid in full and gets its own gift; replay stays idempotent.
    const initialIntent=api.paymentIntents.retrieve.mock.results[0].value
    api.paymentIntents.retrieve.mockImplementation(async(id:string)=>id==='pi_first'?await initialIntent:{id:'pi_next',status:'succeeded',latest_charge:'ch_next'})
    api.invoicePayments.list.mockResolvedValue({data:[{status:'paid',payment:{payment_intent:'pi_next'}}],has_more:false})
    api.invoices.list.mockReturnValue([{id:'in_next',currency:'nzd',billing_reason:'subscription_cycle',total:10304,amount_paid:10304,status:'paid'}])
    api.charges.retrieve.mockImplementation(async(id:string)=>({id,customer:'cus_test',currency:'nzd',amount:10304,amount_refunded:0,livemode:false,paid:true,status:'succeeded',payment_intent:id==='ch_first'?'pi_first':'pi_next',created:Math.floor(Date.now()/1000),balance_transaction:{currency:'nzd',fee:304,net:10000},disputed:false}))
    await reconcileStripeCheckout(pool,row.id)
    await reconcileStripeCheckout(pool,row.id)
    expect((await pool.query('SELECT id FROM giving_gifts')).rows).toHaveLength(2)
    expect((await pool.query("SELECT id FROM giving_email_deliveries WHERE kind='stripe-thanks'")).rows).toHaveLength(1)
  })
  it('authorises future recurring giving without charging early, and creates its schedule only once',async()=>{
    const {row,value}=await recurringCheckout()
    await pool.query("UPDATE giving_stripe_sessions SET creation_started_at=now()-interval '2 days' WHERE checkout_id=$1",[row.id])
    await reconcileStripeCheckout(pool,row.id)
    await reconcileStripeCheckout(pool,row.id)
    expect(api.subscriptionSchedules.create).toHaveBeenCalledTimes(1)
    expect(api.subscriptionSchedules.create.mock.calls[0][0]).toMatchObject({default_settings:{default_payment_method:'pm_test'},phases:[{proration_behavior:'none'}]})
    expect((await pool.query('SELECT consent_id,payment_provider,status,amount_minor FROM giving_schedules')).rows).toEqual([{consent_id:null,payment_provider:'stripe',status:'active',amount_minor:'10000'}])
    expect((await pool.query('SELECT * FROM giving_gifts')).rows).toHaveLength(0)
    expect((await pool.query('SELECT status,first_payment_date FROM giving_checkouts')).rows[0].status).toBe('completed')
    expect(value.firstPaymentDate).not.toBeNull()
  })
  it('recovers an accepted schedule whose local observation rolled back without creating another',async()=>{
    const {row,schedule}=await recurringCheckout()
    api.subscriptionSchedules.create.mockRejectedValueOnce(new Error('Ambiguous timeout'))
    await expect(reconcileStripeCheckout(pool,row.id)).rejects.toThrow('Ambiguous timeout')
    expect((await pool.query('SELECT * FROM giving_stripe_schedule_attempts')).rows).toHaveLength(1)
    api.subscriptionSchedules.list.mockResolvedValue({data:[schedule],has_more:false})
    await reconcileStripeCheckout(pool,row.id)
    expect(api.subscriptionSchedules.create).toHaveBeenCalledTimes(1)
    expect((await pool.query('SELECT * FROM giving_schedules')).rows).toHaveLength(1)
  })
  it('provides invoice authentication recovery and suppresses that notice when retries stop',async()=>{
    const {row,schedule,metadata}=await recurringCheckout()
    schedule.status='active';schedule.subscription='sub_test'
    api.subscriptions.retrieve.mockResolvedValue({metadata,customer:'cus_test',status:'past_due',items:{data:[{current_period_end:Math.floor(Date.now()/1000)+86400}]}})
    api.invoices.list.mockReturnValue([{id:'in_failed',currency:'nzd',total:10304,amount_paid:0,status:'open',attempt_count:1,hosted_invoice_url:'https://invoice.stripe.com/i/test'}])
    api.invoicePayments.list.mockResolvedValue({data:[{status:'open',payment:{payment_intent:'pi_failed'}}],has_more:false})
    api.paymentIntents.retrieve.mockResolvedValue({status:'requires_action'})
    await reconcileStripeCheckout(pool,row.id)
    expect((await pool.query("SELECT kind,action_url FROM giving_email_deliveries WHERE kind='stripe-action'")).rows).toEqual([{kind:'stripe-action',action_url:'https://invoice.stripe.com/i/test'}])
    api.subscriptions.retrieve.mockResolvedValue({metadata,customer:'cus_test',status:'canceled',items:{data:[]}})
    await reconcileStripeCheckout(pool,row.id)
    expect(api.invoices.voidInvoice).toHaveBeenCalledWith('in_failed',{},expect.any(Object))
    expect((await pool.query("SELECT status FROM giving_schedules")).rows[0].status).toBe('cancelled')
    expect((await pool.query("SELECT kind,status FROM giving_email_deliveries WHERE kind IN ('stripe-action','stripe-stopped') ORDER BY kind")).rows).toEqual([{kind:'stripe-action',status:'skipped'},{kind:'stripe-stopped',status:'pending'}])
  })
  it('recovers an ambiguous cancellation with an audited completion and no further collection',async()=>{
    const {row,schedule}=await recurringCheckout()
    await reconcileStripeCheckout(pool,row.id)
    const local=(await pool.query('SELECT id FROM giving_schedules')).rows[0]
    await pool.query("UPDATE giving_schedules SET status='unknown' WHERE id=$1",[local.id])
    await pool.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,schedule_id,actor_id,reason,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status) VALUES('sandbox','sandbox',true,$1,$2,1,'Donor requested cancellation','stripe','stripe.cancel-schedule',1,'digest','cancel-correlation','cancel-request','cancel-key','unknown')`,[row.id,local.id])
    api.subscriptionSchedules.cancel.mockImplementation(async()=>{schedule.status='canceled';return schedule})
    await reconcileStripeGiving(pool)
    expect(api.subscriptionSchedules.cancel).toHaveBeenCalledWith('sub_sched_test',{invoice_now:false,prorate:false},expect.any(Object))
    expect((await pool.query("SELECT status FROM giving_provider_operations WHERE action='stripe.cancel-schedule'")).rows[0].status).toBe('succeeded')
    expect((await pool.query('SELECT status FROM giving_schedules')).rows[0].status).toBe('cancelled')
  })
  it('does not report cancellation confirmed until old invoice links can no longer collect',async()=>{
    const {schedule}=await recurringCheckout()
    schedule.status='active';schedule.subscription='sub_test'
    api.subscriptionSchedules.cancel.mockImplementation(async()=>{schedule.status='canceled';return schedule})
    api.subscriptions.retrieve.mockResolvedValue({status:'canceled'})
    let remaining=true
    api.invoices.list.mockImplementation((input:{status:string})=>{
      const data=input.status==='open'&&remaining?[{id:'in_old'}]:[]
      return {data,has_more:false,async *[Symbol.asyncIterator](){yield*data}}
    })
    api.invoices.voidInvoice.mockRejectedValue(new Error('Temporary failure'))
    const provider=getGivingCancellationProvider('sandbox','stripe')
    expect((await provider.cancelFixedRecurringPayment('sub_sched_test',{requestId:'req',idempotencyKey:'key'})).outcome).toBe('unknown')
    await expect(provider.getFixedRecurringPayment('sub_sched_test')).rejects.toThrow('Temporary failure')
    api.invoices.voidInvoice.mockImplementation(async()=>{remaining=false;return {}})
    await expect(provider.getFixedRecurringPayment('sub_sched_test')).resolves.toEqual({status:'cancelled'})
    expect(api.subscriptionSchedules.cancel).toHaveBeenCalledTimes(1)
  })
  it('persists payouts before gifts and applies the association when the charge arrives',async()=>{
    const event={id:'evt_payout',type:'payout.paid',livemode:false,data:{object:{object:'payout',id:'po_test'}}} as Stripe.Event
    api.payouts.retrieve.mockResolvedValue({id:'po_test',livemode:false,currency:'nzd',status:'paid'})
    api.balanceTransactions.list.mockReturnValue([{source:'ch_test',fee:304,net:10000}])
    await storeStripeEvent(pool,'sandbox',event,JSON.stringify(event))
    await reconcileStripeGiving(pool)
    expect((await pool.query('SELECT payout_id FROM giving_stripe_balances')).rows).toEqual([{payout_id:'po_test'}])
    mockCheckout();await startStripeGiving({...context,submission:submission()},{pool,resolveIdentity})
    const row=(await pool.query('SELECT * FROM giving_checkouts')).rows[0]
    const params=api.checkout.sessions.create.mock.calls[0][0]
    api.checkout.sessions.retrieve.mockResolvedValue({...params,id:'cs_test',livemode:false,currency:'nzd',status:'complete',payment_status:'paid',amount_total:10304,payment_intent:'pi_test'})
    api.paymentIntents.retrieve.mockResolvedValue({id:'pi_test',status:'succeeded',metadata:params.metadata,latest_charge:'ch_test'})
    api.charges.retrieve.mockResolvedValue({id:'ch_test',customer:'cus_test',currency:'nzd',amount:10304,amount_refunded:0,livemode:false,paid:true,status:'succeeded',payment_intent:'pi_test',created:Math.floor(Date.now()/1000),balance_transaction:{currency:'nzd',fee:304,net:10000},disputed:false})
    await reconcileStripeCheckout(pool,row.id)
    expect((await pool.query('SELECT payout_id,payout_status FROM giving_gifts')).rows).toEqual([{payout_id:'po_test',payout_status:'paid'}])
    await pool.query("UPDATE giving_gifts SET payout_id=NULL,payout_status=NULL")
    await reconcileStripeGiving(pool)
    expect((await pool.query('SELECT payout_id FROM giving_gifts')).rows).toEqual([{payout_id:'po_test'}])
  })
  it('deduplicates signed events, quarantines conflicts, and backs failures off so later events progress',async()=>{
    const event={id:'evt_same',type:'payout.paid',livemode:false,data:{object:{object:'payout',id:'po_test'}}} as Stripe.Event
    await storeStripeEvent(pool,'sandbox',event,JSON.stringify(event))
    await storeStripeEvent(pool,'sandbox',event,JSON.stringify(event))
    expect((await pool.query('SELECT * FROM giving_stripe_events')).rows).toHaveLength(1)
    await storeStripeEvent(pool,'sandbox',event,JSON.stringify({...event,created:999}))
    expect((await pool.query('SELECT status FROM giving_stripe_events')).rows[0].status).toBe('quarantined')
    await pool.query(`INSERT INTO giving_stripe_events(environment,event_id,event_type,payload_digest,payload) SELECT 'sandbox','evt_'||i,'payout.paid','digest',jsonb_build_object('type','payout.paid','data',jsonb_build_object('object',jsonb_build_object('object','payout','id','po_bad'))) FROM generate_series(1,100) i`)
    await pool.query(`INSERT INTO giving_stripe_events(environment,event_id,event_type,payload_digest,payload) VALUES('sandbox','evt_later','product.created','digest','{"type":"product.created","data":{"object":{"object":"product"}}}')`)
    api.payouts.retrieve.mockRejectedValue(new Error('Provider unavailable'))
    await reconcileStripeGiving(pool)
    await reconcileStripeGiving(pool)
    expect((await pool.query("SELECT status FROM giving_stripe_events WHERE event_id='evt_later'")).rows[0].status).toBe('processed')
  })

  it('rejects an altered amount without recording a paid gift',async()=>{
    mockCheckout()
    await startStripeGiving({...context,submission:submission()},{pool,resolveIdentity})
    const stored=(await pool.query('SELECT * FROM giving_checkouts')).rows[0]
    const params=api.checkout.sessions.create.mock.calls[0][0]
    api.checkout.sessions.retrieve.mockResolvedValue({...params,id:'cs_test',livemode:false,currency:'nzd',status:'complete',payment_status:'paid',amount_total:1,payment_intent:'pi_test'})
    await expect(reconcileStripeCheckout(pool,stored.id)).rejects.toThrow('total mismatch')
    expect((await pool.query('SELECT * FROM giving_gifts')).rows).toHaveLength(0)
  })
  async function paidStripeCheckout(environment:'sandbox'|'production'='sandbox') {
    mockCheckout()
    api.checkout.sessions.create.mockImplementation(async(params)=>({id:'cs_test',client_secret:'cs_test_secret_example',livemode:environment==='production',currency:'nzd',...params}))
    await startStripeGiving({contextKey:environment,environment,synthetic:environment==='sandbox',submission:submission()},{pool,resolveIdentity})
    const row=(await pool.query('SELECT * FROM giving_checkouts')).rows[0]
    const params=api.checkout.sessions.create.mock.calls[0][0]
    api.checkout.sessions.retrieve.mockResolvedValue({...params,id:'cs_test',livemode:environment==='production',currency:'nzd',status:'complete',payment_status:'paid',amount_total:10304,payment_intent:'pi_test'})
    api.paymentIntents.retrieve.mockResolvedValue({id:'pi_test',status:'succeeded',metadata:params.metadata,latest_charge:'ch_test'})
    const charge={id:'ch_test',customer:'cus_test',currency:'nzd',amount:10304,amount_refunded:0,livemode:environment==='production',paid:true,status:'succeeded',payment_intent:'pi_test',created:Math.floor(Date.now()/1000),balance_transaction:{currency:'nzd',fee:304,net:10000},disputed:false}
    api.charges.retrieve.mockResolvedValue(charge)
    return {row,charge}
  }
  function refund(id:string,amount:number,status='succeeded',charge='ch_test') {
    return {id,amount,status,charge,currency:'nzd',created:Math.floor(Date.now()/1000),balance_transaction:'txn_'+id}
  }
  it.each([2000,10304])('records a %s-cent Stripe refund before gift creation, retaining the original charge and deduplicating replay',async(amount)=>{
    const {row,charge}=await paidStripeCheckout('production')
    charge.amount_refunded=amount
    api.refunds.list.mockReturnValue([refund('re_test',amount)])
    await reconcileStripeCheckout(pool,row.id)
    await reconcileStripeRefunds(pool,'production',charge.id)
    expect((await pool.query('SELECT status,amount_minor,transaction_fee_minor,refunded_minor,refund_pending_minor FROM giving_gifts')).rows).toEqual([{status:'settled',amount_minor:'10000',transaction_fee_minor:'304',refunded_minor:String(amount),refund_pending_minor:'0'}])
    expect((await pool.query('SELECT refund_id,status FROM giving_stripe_refunds')).rows).toEqual([{refund_id:'re_test',status:'succeeded'}])
    vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT','production')
    const history=await getMemberGiftHistoryPage({auth0Subject:'test',rockPersonId:123,rockPersonAliasId:123,email:'ada@example.com'},1,pool)
    expect(history.gifts[0]).toMatchObject({amountMinor:10000,refundedMinor:amount,refundPendingMinor:0})
    const csv=await givingFinanceCsv(pool,'2026-01-01','2026-12-31')
    const lines=csv.trim().split('\r\n').map(line=>line.replace(/^\uFEFF/,'').split(',').map(cell=>cell.slice(1,-1)))
    expect(lines[1][lines[0].indexOf('refunded_cents')]).toBe(String(amount))
    expect(lines[1][lines[0].indexOf('retained_charge_cents')]).toBe(String(10304-amount))
  })
  it('tracks pending, failed and succeeded refund states without treating pending refunds as returned cash',async()=>{
    const {row,charge}=await paidStripeCheckout()
    await reconcileStripeCheckout(pool,row.id)
    api.refunds.list.mockReturnValue([refund('re_pending',2000,'pending'),refund('re_failed',1000,'failed')])
    await reconcileStripeRefunds(pool,'sandbox',charge.id)
    expect((await pool.query('SELECT refunded_minor,refund_pending_minor FROM giving_gifts')).rows[0]).toEqual({refunded_minor:'0',refund_pending_minor:'2000'})
    charge.amount_refunded=2000
    api.refunds.list.mockReturnValue([refund('re_pending',2000),refund('re_failed',1000,'failed')])
    await reconcileStripeRefunds(pool,'sandbox',charge.id)
    expect((await pool.query('SELECT refunded_minor,refund_pending_minor FROM giving_gifts')).rows[0]).toEqual({refunded_minor:'2000',refund_pending_minor:'0'})
    api.refunds.list.mockReturnValue([])
    await expect(reconcileStripeRefunds(pool,'sandbox',charge.id)).rejects.toThrow('incomplete')
    expect((await pool.query('SELECT refunded_minor FROM giving_gifts')).rows[0].refunded_minor).toBe('2000')
  })
  it('recovers refunds through webhook processing and through polling completed one-off gifts when a webhook is missed',async()=>{
    const {row,charge}=await paidStripeCheckout()
    await reconcileStripeCheckout(pool,row.id)
    charge.amount_refunded=1000
    api.refunds.list.mockReturnValue([refund('re_first',1000)])
    const event={id:'evt_refund',type:'charge.refunded',livemode:false,data:{object:{object:'charge',id:charge.id}}} as Stripe.Event
    await storeStripeEvent(pool,'sandbox',event,JSON.stringify(event))
    await reconcileStripeGiving(pool)
    expect((await pool.query('SELECT refunded_minor FROM giving_gifts')).rows[0].refunded_minor).toBe('1000')
    charge.amount_refunded=3000
    api.refunds.list.mockReturnValue([refund('re_first',1000),refund('re_second',2000)])
    await reconcileStripeGiving(pool)
    expect((await pool.query('SELECT refunded_minor FROM giving_gifts')).rows[0].refunded_minor).toBe('3000')
    expect((await pool.query('SELECT id FROM giving_gifts')).rows).toHaveLength(1)
  })
  it('rejects refund ownership mismatches and rolls back every adjustment',async()=>{
    const {row,charge}=await paidStripeCheckout()
    await reconcileStripeCheckout(pool,row.id)
    api.refunds.list.mockReturnValue([refund('re_wrong',1000,'succeeded','ch_other')])
    await expect(reconcileStripeRefunds(pool,'sandbox',charge.id)).rejects.toThrow('provenance')
    expect((await pool.query('SELECT * FROM giving_stripe_refunds')).rows).toHaveLength(0)
    expect((await pool.query('SELECT refunded_minor FROM giving_gifts')).rows[0].refunded_minor).toBe('0')
    charge.livemode=true
    await expect(reconcileStripeRefunds(pool,'sandbox',charge.id)).rejects.toThrow('charge mismatch')
  })

  async function cardUpdateFixture(includeLatest=true) {
    const {row,schedule}=await recurringCheckout()
    await reconcileStripeCheckout(pool,row.id)
    const local=(await pool.query('SELECT id FROM giving_schedules')).rows[0]
    const versions=new Map<string,string>()
    async function reserve(sessionId:string) {
      const update=(await pool.query<{version:string}>(`INSERT INTO giving_stripe_card_updates(schedule_id,customer_id,environment)
        SELECT id,'cus_test','sandbox' FROM giving_schedules WHERE id=$1 AND status='active' FOR UPDATE RETURNING version`,[local.id])).rows[0]
      await pool.query('UPDATE giving_stripe_card_updates SET session_id=$2 WHERE version=$1',[update.version,sessionId])
      versions.set(sessionId,update.version)
      return update.version
    }
    const old=await reserve('cs_old'), latest=includeLatest?await reserve('cs_new'):old
    api.checkout.sessions.retrieve.mockImplementation(async(id:string)=>({id,status:'complete',mode:'setup',livemode:false,customer:'cus_test',setup_intent:id==='cs_new'?'seti_new':'seti_old',metadata:{ev_card_update:String(local.id),ev_card_update_version:versions.get(id)}}))
    api.setupIntents.retrieve.mockImplementation(async(id:string)=>({id,status:'succeeded',customer:'cus_test',payment_method:id==='seti_new'?'pm_new':'pm_old'}))
    api.subscriptionSchedules.retrieve.mockResolvedValue({...schedule,status:'released',released_subscription:'sub_test'})
    return {id:local.id,old,latest,reserve}
  }
  it('preserves legacy card-update links as superseded and gives new requests eligible versions',async()=>{
    const {row}=await recurringCheckout()
    await reconcileStripeCheckout(pool,row.id)
    const local=(await pool.query('SELECT id FROM giving_schedules')).rows[0]
    // Reconstruct the previous schema to exercise the actual upgrade with a legacy row.
    await pool.query(`ALTER TABLE giving_gifts DROP CONSTRAINT giving_gift_refunds_valid,
      DROP COLUMN refunded_minor,DROP COLUMN refund_pending_minor,DROP COLUMN refunds_verified_at,DROP COLUMN refunds_last_attempt_at;
      DROP TABLE giving_stripe_refunds; DROP TABLE giving_stripe_card_updates;
      CREATE TABLE giving_stripe_card_updates(session_id varchar PRIMARY KEY,schedule_id integer NOT NULL REFERENCES giving_schedules(id),customer_id varchar NOT NULL,environment varchar NOT NULL)`)
    await pool.query("INSERT INTO giving_stripe_card_updates VALUES('cs_legacy',$1,'cus_test','sandbox')",[local.id])
    await pool.query(GIVING_FINANCIAL_CONTROLS_UP_SQL)
    const legacy=(await pool.query('SELECT session_id,version,superseded FROM giving_stripe_card_updates')).rows[0]
    expect(legacy).toMatchObject({session_id:'cs_legacy',superseded:true})
    const next=(await pool.query("INSERT INTO giving_stripe_card_updates(schedule_id,customer_id,environment) VALUES($1,'cus_test','sandbox') RETURNING version,superseded",[local.id])).rows[0]
    expect(BigInt(next.version)).toBeGreaterThan(BigInt(legacy.version))
    expect(next.superseded).toBe(false)
    await applyStripeCardUpdate(pool,'sandbox','cs_legacy',local.id)
    expect(api.subscriptionSchedules.update).not.toHaveBeenCalled()
    expect(api.subscriptions.update).not.toHaveBeenCalled()
  })
  it('ignores a delayed older card update and serializes duplicate completion workers',async()=>{
    const fixture=await cardUpdateFixture()
    await Promise.all([applyStripeCardUpdate(pool,'sandbox','cs_new',fixture.id),applyStripeCardUpdate(pool,'sandbox','cs_old',fixture.id),applyStripeCardUpdate(pool,'sandbox','cs_new',fixture.id)])
    expect(api.subscriptions.update.mock.calls.map(call=>call[1].default_payment_method)).toEqual(['pm_new'])
    expect((await pool.query('SELECT version FROM giving_stripe_card_updates WHERE applied_at IS NOT NULL')).rows).toEqual([{version:fixture.latest}])
    expect(api.checkout.sessions.retrieve).not.toHaveBeenCalledWith('cs_old')
  })
  it('retries a partially applied update under the same provider idempotency key',async()=>{
    const fixture=await cardUpdateFixture()
    api.subscriptions.update.mockRejectedValueOnce(new Error('Timeout')).mockResolvedValueOnce({})
    await expect(applyStripeCardUpdate(pool,'sandbox','cs_new',fixture.id)).rejects.toThrow('Timeout')
    expect((await pool.query('SELECT applied_at FROM giving_stripe_card_updates WHERE version=$1',[fixture.latest])).rows[0].applied_at).toBeNull()
    await applyStripeCardUpdate(pool,'sandbox','cs_new',fixture.id)
    expect(api.subscriptions.update.mock.calls.map(call=>call[2].idempotencyKey)).toEqual(['giving-card-sub-cs_new','giving-card-sub-cs_new'])
    await pool.query("UPDATE giving_schedules SET status='cancelled' WHERE id=$1",[fixture.id])
    await applyStripeCardUpdate(pool,'sandbox','cs_new',fixture.id)
    expect(api.subscriptions.update).toHaveBeenCalledTimes(2)
  })

  it('fences a timed-out old mutation until its idempotent result is recovered before applying a newer card',async()=>{
    const fixture=await cardUpdateFixture(false)
    let providerMethod='pm_initial'
    api.subscriptions.update.mockRejectedValueOnce(new Error('Ambiguous timeout'))
    await expect(applyStripeCardUpdate(pool,'sandbox','cs_old',fixture.id)).rejects.toThrow('Ambiguous timeout')
    await fixture.reserve('cs_new')
    let releaseOld:()=>void=()=>{}
    let oldRetryStarted:()=>void=()=>{}
    const retried=new Promise<void>(resolve=>{oldRetryStarted=resolve})
    api.subscriptions.update.mockImplementation(async(_id,params,options)=>{
      if(options.idempotencyKey==='giving-card-sub-cs_old') {
        oldRetryStarted()
        await new Promise<void>(resolve=>{releaseOld=resolve})
      }
      providerMethod=params.default_payment_method
      return {}
    })
    const applying=applyStripeCardUpdate(pool,'sandbox','cs_new',fixture.id)
    await retried
    expect(api.subscriptions.update.mock.calls.some(call=>call[1].default_payment_method==='pm_new')).toBe(false)
    releaseOld()
    await applying
    expect(providerMethod).toBe('pm_new')
    expect(api.subscriptions.update.mock.calls.map(call=>call[2].idempotencyKey)).toEqual(['giving-card-sub-cs_old','giving-card-sub-cs_old','giving-card-sub-cs_new'])
  })

  async function blinkPayRecurringFixture() {
    const value={...submission(),frequency:'monthly' as const,firstPaymentDate:'2026-12-01'}
    const created=await createPostgresGivingCheckoutRepository(pool).createOrReuse({...context,submission:value,submissionKeyDigest:'blink-key',submissionDigest:'blink-digest',correlationKey:'blink-correlation',returnCapabilityDigest:'blink-return',returnCapabilityExpiresAt:new Date(Date.now()+10000),currentTime:new Date()})
    await resolveIdentity({checkoutId:created.checkout.id})
    const row=(await pool.query('SELECT c.*,g.bank_reference FROM giving_checkouts c JOIN giving_givers g ON g.id=c.giver_id WHERE c.id=$1',[created.checkout.id])).rows[0]
    const consentId='22222222-2222-4222-8222-222222222222',scheduleId='33333333-3333-4333-8333-333333333333'
    const consent=(await pool.query(`INSERT INTO giving_consents(context_key,environment,synthetic,checkout_id,giver_id,provider_consent_id,status) VALUES('sandbox','sandbox',true,$1,$2,$3,'authorised') RETURNING id`,[row.id,row.giver_id,consentId])).rows[0]
    const local=(await pool.query(`INSERT INTO giving_schedules(context_key,environment,synthetic,checkout_id,giver_id,consent_id,provider_schedule_id,status,frequency,amount_minor,transaction_fee_minor) VALUES('sandbox','sandbox',true,$1,$2,$3,$4,'active','monthly',10000,304) RETURNING id`,[row.id,row.giver_id,consent.id,scheduleId])).rows[0]
    const detail={consent_id:consentId,amount:{currency:'NZD' as const,total:'103.04'},pcr:{particulars:row.fund_code.slice(0,12),code:row.bank_code,reference:row.bank_reference}}
    const payment={payment_id:'44444444-4444-4444-8444-444444444444',type:'enduring',status:'AcceptedSettlementCompleted',creation_timestamp:'2026-11-02T00:00:00Z',status_updated_timestamp:'2026-11-02T00:01:00Z',refunds:[],detail}
    const schedule={fixed_recurring_payment_id:scheduleId,consent_id:consentId,status:'active',start_date:'2026-12-01',next_payment_date:'2026-12-01',amount:detail.amount,pcr:detail.pcr,retry_strategy:'same_day' as const,creation_timestamp:payment.creation_timestamp}
    const provider={getPayment:vi.fn().mockResolvedValue(payment),getFixedRecurringPayment:vi.fn().mockResolvedValue(schedule),getEnduringConsent:vi.fn().mockResolvedValue({consent_id:consentId,payments:[payment]})}
    return {row,local,payment,provider,consent}
  }
  it.each(['amount','reference','currency','payment-id'] as const)('quarantines a BlinkPay webhook with mismatched %s before recording a gift',async(field)=>{
    const {payment,provider}=await blinkPayRecurringFixture()
    const reference=payment.payment_id
    if(field==='amount')payment.detail.amount.total='0.01'
    if(field==='reference')payment.detail.pcr.reference='EV999'
    if(field==='currency')Object.assign(payment.detail.amount,{currency:'USD'})
    if(field==='payment-id')payment.payment_id='55555555-5555-4555-8555-555555555555'
    const store=createPostgresGivingLifecycleStore(pool)
    const event=await store.recordVerifiedEvent({environment:'sandbox',eventId:'bad-payment',eventType:'completed',referenceType:'payment',referenceId:reference,payloadDigest:'digest',payload:{},now:new Date()})
    await createGivingLifecycleProcessor({store,provider:()=>provider}).process(event.eventId)
    expect((await pool.query('SELECT status FROM blinkpay_webhook_events')).rows[0].status).toBe('quarantined')
    expect((await pool.query('SELECT * FROM giving_gifts')).rows).toHaveLength(0)
  })
  it('rechecks webhook-settled payments through validated reconciliation and rejects mismatches for an existing gift',async()=>{
    const {payment,provider}=await blinkPayRecurringFixture()
    const store=createPostgresGivingLifecycleStore(pool)
    async function event(id:string) {
      const event=await store.recordVerifiedEvent({environment:'sandbox',eventId:id,eventType:'completed',referenceType:'payment',referenceId:payment.payment_id,payloadDigest:id,payload:{},now:new Date()})
      return createGivingLifecycleProcessor({store,provider:()=>provider}).process(event.eventId)
    }
    await event('valid')
    expect((await pool.query('SELECT status,amount_minor FROM giving_gifts')).rows).toEqual([{status:'settled',amount_minor:'10000'}])
    provider.getPayment.mockClear()
    await reconcileRecurringGiving({pool,provider:()=>provider})
    expect(provider.getPayment).toHaveBeenCalledOnce()
    provider.getPayment.mockClear()
    await reconcileRecurringGiving({pool,provider:()=>provider})
    expect(provider.getPayment).not.toHaveBeenCalled()
    payment.detail.amount.total='0.01'
    await event('mismatch-existing')
    expect((await pool.query("SELECT status FROM blinkpay_webhook_events WHERE provider_event_id='mismatch-existing'")).rows[0].status).toBe('quarantined')
    expect((await pool.query('SELECT amount_minor FROM giving_gifts')).rows[0].amount_minor).toBe('10000')
  })

})
