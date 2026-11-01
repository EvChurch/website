import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type Stripe from 'stripe'
import type { GivingContext, GivingCheckoutStatus } from '../contracts'
import type { GivingIdentityInput, ResolvedGivingIdentity } from '../rock-identity'
import { createPostgresGivingCheckoutRepository, submissionKeyDigest, canonicalSubmissionDigest, capabilityDigest, GivingCheckoutError, queueGivingCompletionEmails, type GivingCheckoutSubmission } from '../service'
import { getGivingStripe, loadStripeGivingConfig } from './config'
import { givingAnchorTimestamp, nextGivingAnchor, nzGivingDate } from './dates'

export function stripeObjectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === 'string' ? value : value?.id ?? null
}

export function recurringInterval(frequency: string): { interval: 'day' | 'week' | 'month' | 'year'; interval_count: number } {
  switch (frequency) {
    case 'weekly': return { interval: 'week', interval_count: 1 }
    case 'fortnightly': return { interval: 'week', interval_count: 2 }
    case 'monthly': return { interval: 'month', interval_count: 1 }
    case 'annual': return { interval: 'year', interval_count: 1 }
    default: throw new GivingCheckoutError('invalid')
  }
}

/** Today is an immediate first payment; future dates use a calendar-safe anchor. */
export function givingStartTimestamp(date: string, now = new Date()): number | 'now' {
  try {
    const anchor=givingAnchorTimestamp(date)
    if(date<nzGivingDate(now))throw new Error('Past giving date')
    return date===nzGivingDate(now)?'now':anchor
  } catch {throw new GivingCheckoutError('invalid')}
}

export async function startStripeGiving(input: GivingContext & { submission: GivingCheckoutSubmission }, dependencies: {
  pool: Pool
  resolveIdentity(input: GivingContext & { checkoutId: number; identity: GivingIdentityInput }): Promise<ResolvedGivingIdentity>
}) {
  const { pool } = dependencies
  const secret = process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? ''
  const repository = createPostgresGivingCheckoutRepository(pool)
  const now = new Date()
  if(input.submission.amountMinor<100)throw new GivingCheckoutError('invalid')
  if (input.submission.frequency !== 'one-off') {
    recurringInterval(input.submission.frequency)
    givingStartTimestamp(input.submission.firstPaymentDate!, now)
  }
  const keyDigest = submissionKeyDigest(secret, input, input.submission.submissionKey)
  const token = createHmac('sha256', secret).update(`giving-stripe-status-v1\0${keyDigest}`).digest('base64url')
  const created = await repository.createOrReuse({ ...input, paymentProvider: 'stripe',
    submissionKeyDigest: keyDigest,
    submissionDigest: createHash('sha256').update(`stripe\0${canonicalSubmissionDigest(secret, input.submission)}`).digest('hex'),
    correlationKey: randomUUID(), returnCapabilityDigest: capabilityDigest('return', randomBytes(32).toString('base64url')),
    returnCapabilityExpiresAt: new Date(now.getTime() + 30 * 60_000), currentTime: now,
  })
  const checkout = created.checkout
  await repository.rotateStatusCapability(checkout.id, capabilityDigest('status', token), capabilityDigest('status', token), new Date(now.getTime() + 60 * 60_000))
  const config = loadStripeGivingConfig(input.environment)
  const existing = (await pool.query<{session_id: string | null; client_secret: string | null}>('SELECT session_id,client_secret FROM giving_stripe_sessions WHERE checkout_id=$1', [checkout.id])).rows[0]
  if (existing?.client_secret && !['failed','completed'].includes(checkout.status)) return { outcome: 'embedded' as const, clientSecret: existing.client_secret, publishableKey: config.publishableKey, statusToken: token }
  if (existing || created.disposition === 'recover') return { outcome: 'unknown' as const, retryAllowed: false as const, statusToken: token, correlationKey: checkout.correlationKey, reused: created.reused }
  const resolvedIdentity = await dependencies.resolveIdentity({ ...input, checkoutId: checkout.id, identity: { kind: 'guest', firstName: input.submission.firstName, lastName: input.submission.lastName, email: input.submission.email } })
  // One local claimant can create a provider checkout. Ambiguous results are recovered by webhook/reconciliation, never a new key.
  const firstPaymentImmediate = checkout.frequency !== 'one-off' && givingStartTimestamp(checkout.firstPaymentDate!,now) === 'now'
  const claim = await pool.query('INSERT INTO giving_stripe_sessions(checkout_id,first_payment_immediate) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING checkout_id', [checkout.id,firstPaymentImmediate])
  if (!claim.rowCount) return { outcome: 'unknown' as const, retryAllowed: false as const, statusToken: token, correlationKey: checkout.correlationKey, reused: created.reused }
  await pool.query(`INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status)
    VALUES($1,$2,$3,$4,'stripe','stripe.create-checkout',1,$5,$6,$6,$6,'submitted')`, [input.contextKey,input.environment,input.synthetic,checkout.id,checkout.submissionDigest,checkout.correlationKey])
  await pool.query("UPDATE giving_checkouts SET status='authorising',updated_at=now() WHERE id=$1 AND status='draft'", [checkout.id])
  const stripe = getGivingStripe(input.environment)
  try {
    const metadata = { ev_giving: 'v1', ev_checkout_id: String(checkout.id), ev_checkout_version: checkout.submissionDigest, ev_context: input.contextKey, ev_immediate: firstPaymentImmediate ? 'true' : 'false' }
    const customer = await stripe.customers.create({ name: `${resolvedIdentity.firstName} ${resolvedIdentity.lastName}`, email: resolvedIdentity.email, metadata }, { idempotencyKey: `giving-customer-${checkout.correlationKey}` })
    await pool.query('UPDATE giving_stripe_sessions SET customer_id=$2 WHERE checkout_id=$1', [checkout.id,customer.id])
    const setupOnly = checkout.frequency !== 'one-off' && !firstPaymentImmediate
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'elements', mode: setupOnly ? 'setup' : 'payment', customer: customer.id,
      allowed_payment_method_types: ['card'], currency: 'nzd', metadata,
      return_url: `${config.origin}/give?giving=return`, expires_at: Math.floor(Date.now()/1000)+31*60,
      ...(setupOnly ? { setup_intent_data: { metadata } } : {
        line_items: [ { price_data: { currency: 'nzd', unit_amount: checkout.amountMinor, product_data: { name: `Gift to ${checkout.fundName}` } }, quantity: 1 },
          ...(checkout.transactionFeeMinor ? [{ price_data: { currency: 'nzd', unit_amount: checkout.transactionFeeMinor, product_data: { name: 'Payment fee' } }, quantity: 1 }] : []) ],
        payment_intent_data: { metadata, ...(firstPaymentImmediate ? { setup_future_usage: 'off_session' as const } : {}) }, automatic_tax: { enabled: false }, adaptive_pricing: { enabled: false },
      }),
    }, { idempotencyKey: `giving-checkout-${checkout.correlationKey}` })
    if (!session.client_secret || session.livemode !== (input.environment === 'production')) throw new Error('Stripe checkout mismatch')
    await pool.query('UPDATE giving_stripe_sessions SET session_id=$2,client_secret=$3 WHERE checkout_id=$1', [checkout.id,session.id,session.client_secret])
    await pool.query("UPDATE giving_provider_operations SET status='succeeded',provider_id=$2,updated_at=now() WHERE checkout_id=$1 AND action='stripe.create-checkout'", [checkout.id,session.id])
    return { outcome: 'embedded' as const, clientSecret: session.client_secret, publishableKey: config.publishableKey, statusToken: token }
  } catch {
    await pool.query("UPDATE giving_checkouts SET status='unknown',result_code='unknown',updated_at=now() WHERE id=$1 AND status<>'completed'", [checkout.id])
    return { outcome: 'unknown' as const, retryAllowed: false as const, statusToken: token, correlationKey: checkout.correlationKey, reused: created.reused }
  }
}

interface StripeCheckoutRow {
  id: number; context_key: string; environment: GivingContext['environment']; synthetic: boolean; giver_id: number;
  fund_id: number; fund_name: string; fund_code: string; fund_accounting_key: string;
  amount_minor: string; transaction_fee_minor: string; frequency: string; first_payment_date: Date | string | null;
  correlation_key: string; submission_digest: string; status: string;
  session_id: string | null; customer_id: string | null; subscription_id: string | null; creation_started_at: Date; first_payment_immediate: boolean; schedule_started_at: Date | null
}

async function queueNotice(db: PoolClient, checkoutId: number, kind: 'stripe-failed' | 'stripe-action' | 'stripe-stopped', key: string, recoveryUrl?: string | null) {
  const candidate = recoveryUrl ? new URL(recoveryUrl) : null
  if (candidate && (candidate.origin !== 'https://invoice.stripe.com' || candidate.username || candidate.password)) throw new Error('Invalid recovery destination')
  await db.query(`INSERT INTO giving_email_deliveries(checkout_id,kind,event_key,action_url) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [checkoutId,kind,key,recoveryUrl ?? `${loadStripeGivingConfig((await db.query<{environment: GivingContext['environment']}>('SELECT environment FROM giving_checkouts WHERE id=$1',[checkoutId])).rows[0].environment).origin}/members/giving`])
}

async function recordCharge(db: PoolClient, stripe: Stripe, row: StripeCheckoutRow, chargeId: string, scheduleId: number | null, invoiceId: string | null = null) {
  const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] })
  if (stripeObjectId(charge.customer) !== row.customer_id || charge.currency !== 'nzd' || charge.amount !== Number(row.amount_minor) + Number(row.transaction_fee_minor) || charge.livemode !== (row.environment === 'production')) throw new Error('Stripe payment provenance mismatch')
  if (!charge.paid || charge.status !== 'succeeded') throw new Error('Stripe charge is not successful')
  const rawBalance = typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null
  const balance = rawBalance?.currency === 'nzd' ? rawBalance : null
  const paymentId = stripeObjectId(charge.payment_intent)
  if (!paymentId) throw new Error('Missing Stripe payment reference')
  const payout = (await db.query<{payout_id:string;fee_minor:string;net_minor:string;payout_status:string}>('SELECT payout_id,fee_minor,net_minor,payout_status FROM giving_stripe_balances WHERE environment=$1 AND charge_id=$2',[row.environment,charge.id])).rows[0]
  const recorded = await db.query(`INSERT INTO giving_gifts(context_key,environment,synthetic,checkout_id,giver_id,schedule_id,fund_id,fund_name,fund_code,fund_accounting_key,amount_minor,transaction_fee_minor,payment_provider,provider_payment_id,provider_charge_id,status,provider_status,provider_verified_at,provider_observed_at,provider_source,processing_fee_minor,net_minor,dispute_status,payout_id,payout_status,provider_invoice_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'stripe',$13,$14,'settled','succeeded',now(),to_timestamp($15),'reconciliation',$16,$17,$18,$19,$20,$21)
    ON CONFLICT(environment,payment_provider,provider_payment_id) DO UPDATE SET schedule_id=COALESCE(giving_gifts.schedule_id,EXCLUDED.schedule_id),processing_fee_minor=EXCLUDED.processing_fee_minor,net_minor=EXCLUDED.net_minor,dispute_status=COALESCE(giving_gifts.dispute_status,EXCLUDED.dispute_status),payout_id=COALESCE(EXCLUDED.payout_id,giving_gifts.payout_id),payout_status=COALESCE(EXCLUDED.payout_status,giving_gifts.payout_status),provider_verified_at=now()
    WHERE giving_gifts.checkout_id=EXCLUDED.checkout_id AND giving_gifts.amount_minor=EXCLUDED.amount_minor AND giving_gifts.transaction_fee_minor=EXCLUDED.transaction_fee_minor RETURNING id`, [row.context_key,row.environment,row.synthetic,row.id,row.giver_id,scheduleId,row.fund_id,row.fund_name,row.fund_code,row.fund_accounting_key,row.amount_minor,row.transaction_fee_minor,paymentId,charge.id,charge.created,payout?.fee_minor ?? balance?.fee ?? null,payout?.net_minor ?? balance?.net ?? null,charge.disputed ? 'disputed' : null,payout?.payout_id ?? null,payout?.payout_status ?? null,invoiceId])
  if (recorded.rowCount !== 1) throw new Error('Stripe payment reference conflict')
}

async function readInitialRecurringPayment(stripe: Stripe, session: Stripe.Checkout.Session, row: StripeCheckoutRow) {
  if(session.mode!=='payment' || session.payment_status!=='paid' || session.currency!=='nzd' || session.amount_total!==Number(row.amount_minor)+Number(row.transaction_fee_minor))throw new Error('Initial recurring payment not verified')
  const intent=await stripe.paymentIntents.retrieve(stripeObjectId(session.payment_intent)!)
  if(intent.status!=='succeeded' || intent.setup_future_usage!=='off_session' || intent.metadata.ev_checkout_id!==String(row.id) || intent.metadata.ev_checkout_version!==row.submission_digest || stripeObjectId(intent.customer)!==row.customer_id)throw new Error('Initial recurring payment mismatch')
  const paymentMethod=stripeObjectId(intent.payment_method)
  const charge=stripeObjectId(intent.latest_charge)
  if(!paymentMethod || !charge)throw new Error('Initial recurring payment references missing')
  return {paymentMethod,charge}
}

export async function reconcileStripeCheckout(pool: Pool, checkoutId: number, sessionId?: string) {
    // Persist the first schedule attempt outside the observation transaction: a network timeout
    // must not roll its idempotency age back along with the local observations.
    const preflight = (await pool.query<StripeCheckoutRow>(`SELECT c.*,c.first_payment_date::text,s.session_id,s.customer_id,s.first_payment_immediate FROM giving_checkouts c JOIN giving_stripe_sessions s ON s.checkout_id=c.id WHERE c.id=$1 AND c.payment_provider='stripe'`,[checkoutId])).rows[0]
    if (!preflight) throw new Error('Stripe checkout missing')
    const preflightId = preflight.session_id ?? sessionId
    if (preflight.frequency !== 'one-off' && preflightId) {
      const observed = await getGivingStripe(preflight.environment).checkout.sessions.retrieve(preflightId)
      if (observed.status==='complete' && (observed.mode==='setup' || preflight.first_payment_immediate && observed.mode==='payment' && observed.payment_status==='paid') && observed.metadata?.ev_checkout_id===String(preflight.id) && observed.metadata.ev_checkout_version===preflight.submission_digest && observed.metadata.ev_context===preflight.context_key && stripeObjectId(observed.customer)===preflight.customer_id && observed.livemode===(preflight.environment==='production')) {
        if(preflight.first_payment_immediate) {
          const stripe=getGivingStripe(preflight.environment)
          const initial=await readInitialRecurringPayment(stripe,observed,preflight)
          const cash=await pool.connect()
          try {
            await cash.query('BEGIN')
            await cash.query('SELECT id FROM giving_checkouts WHERE id=$1 FOR UPDATE',[checkoutId])
            // Cash received is a financial fact even if arranging later payments fails.
            await recordCharge(cash,stripe,preflight,initial.charge,null)
            await cash.query('COMMIT')
          } catch(error) {await cash.query('ROLLBACK');throw error} finally {cash.release()}
        }
        await pool.query('INSERT INTO giving_stripe_schedule_attempts(checkout_id) VALUES($1) ON CONFLICT DO NOTHING',[checkoutId])
      }
    }
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const row = (await db.query<StripeCheckoutRow>(`SELECT c.*,c.first_payment_date::text,s.session_id,s.customer_id,s.subscription_id,s.creation_started_at,s.first_payment_immediate,(SELECT started_at FROM giving_stripe_schedule_attempts WHERE checkout_id=c.id) schedule_started_at FROM giving_checkouts c JOIN giving_stripe_sessions s ON s.checkout_id=c.id WHERE c.id=$1 AND c.payment_provider='stripe' FOR UPDATE OF c,s`, [checkoutId])).rows[0]
    if (!row || !row.giver_id) throw new Error('Stripe checkout missing')
    const stripe = getGivingStripe(row.environment)
    const id = row.session_id ?? sessionId
    if (!id) { await db.query('COMMIT'); return }
    const session = await stripe.checkout.sessions.retrieve(id)
    if (session.metadata?.ev_checkout_id !== String(row.id) || session.metadata.ev_checkout_version !== row.submission_digest || session.metadata.ev_context !== row.context_key || session.livemode !== (row.environment === 'production') || stripeObjectId(session.customer) !== row.customer_id || session.currency !== 'nzd') throw new Error('Stripe checkout provenance mismatch')
    if (session.status === 'expired' && row.status !== 'completed') {
      await db.query("UPDATE giving_checkouts SET status='failed',result_code='expired',updated_at=now() WHERE id=$1",[row.id])
    } else if (session.status === 'complete') {
      await db.query('UPDATE giving_stripe_sessions SET session_id=$2,verified_at=now() WHERE checkout_id=$1', [row.id,id])
      if (row.frequency === 'one-off') {
        if (session.mode !== 'payment' || session.amount_total !== Number(row.amount_minor)+Number(row.transaction_fee_minor)) throw new Error('Stripe total mismatch')
        if (session.payment_status === 'paid') {
          const intent = await stripe.paymentIntents.retrieve(stripeObjectId(session.payment_intent)!)
          if (intent.status !== 'succeeded' || intent.metadata.ev_checkout_id !== String(row.id) || intent.metadata.ev_checkout_version !== row.submission_digest) throw new Error('Stripe payment mismatch')
          await recordCharge(db,stripe,row,stripeObjectId(intent.latest_charge)!,null)
          await complete(db,row)
        }
      } else {
        let paymentMethod: string | null = null
        let initialCharge: string | null = null
        if (row.first_payment_immediate) {
          const initial=await readInitialRecurringPayment(stripe,session,row)
          paymentMethod=initial.paymentMethod
          initialCharge=initial.charge
        } else {
          if (session.mode !== 'setup') throw new Error('Stripe recurring checkout mismatch')
          const setup = await stripe.setupIntents.retrieve(stripeObjectId(session.setup_intent)!)
          if (setup.status !== 'succeeded' || stripeObjectId(setup.customer) !== row.customer_id || setup.metadata?.ev_checkout_version !== row.submission_digest) throw new Error('Stripe authorisation mismatch')
          paymentMethod=stripeObjectId(setup.payment_method)
        }
        if(!paymentMethod || row.first_payment_immediate && !initialCharge)throw new Error('Recurring payment method missing')
        const metadata = { ev_giving: 'v1', ev_checkout_id: String(row.id), ev_checkout_version: row.submission_digest, ev_context: row.context_key }
        let local = (await db.query<{id:number;provider_schedule_id:string;status:string}>("SELECT id,provider_schedule_id,status FROM giving_schedules WHERE checkout_id=$1 AND payment_provider='stripe'",[row.id])).rows[0]
        let schedule: Stripe.SubscriptionSchedule
        if (local) schedule = await stripe.subscriptionSchedules.retrieve(local.provider_schedule_id)
        else {
          // Recover an ambiguous create without ever reusing an expired Stripe idempotency key.
          const matches = await stripe.subscriptionSchedules.list({ customer: row.customer_id!, limit: 100 })
          const recovered = matches.data.find(item => item.metadata?.ev_checkout_id === String(row.id) && item.metadata.ev_checkout_version === row.submission_digest)
          if (!recovered && (matches.has_more || (!row.schedule_started_at || Date.now()-row.schedule_started_at.getTime()>23*3600_000))) throw new Error('Stripe schedule needs reconciliation')
          const price = recovered ? null : await stripe.prices.create({ currency:'nzd', unit_amount:Number(row.amount_minor)+Number(row.transaction_fee_minor), recurring:recurringInterval(row.frequency), product_data:{name:`Recurring gift and payment fee: ${row.fund_name}`},metadata }, {idempotencyKey:`giving-price-${row.correlation_key}`})
          const date = row.first_payment_date instanceof Date ? row.first_payment_date.toISOString().slice(0,10) : String(row.first_payment_date).slice(0,10)
          const start=givingAnchorTimestamp(date)
          if (!recovered) {
            if(row.first_payment_immediate) {
              if(Date.now()/1000>=nextGivingAnchor(start,row.frequency as GivingCheckoutSubmission['frequency']))throw new Error('Paid first gift needs schedule reconciliation')
            } else if(date<nzGivingDate() || start<=Date.now()/1000) {
              await db.query("UPDATE giving_checkouts SET status='failed',result_code='expired',updated_at=now() WHERE id=$1",[row.id])
              await queueNotice(db,row.id,'stripe-stopped',`missed-start-${row.id}`)
              await db.query('COMMIT');return
            }
          }
          const coupon=!recovered && row.first_payment_immediate
            ? await stripe.coupons.create({duration:'forever',percent_off:100,name:'First gift already paid',metadata},{idempotencyKey:`giving-first-paid-${row.correlation_key}`}) : null
          const phase: Stripe.SubscriptionScheduleCreateParams.Phase={items:[{price:price?.id??'',quantity:1}],duration:recurringInterval(row.frequency),metadata,proration_behavior:'none',default_tax_rates:[],billing_cycle_anchor:'automatic'}
          schedule = recovered ?? await stripe.subscriptionSchedules.create({ customer:row.customer_id!, start_date:start, end_behavior:'release', metadata,
            default_settings:{default_payment_method:paymentMethod,collection_method:'charge_automatically',automatic_tax:{enabled:false}},
            phases:row.first_payment_immediate
              ? [{...phase,discounts:[{coupon:coupon!.id}]},{...phase,discounts:''}]
              : [phase],
          },{idempotencyKey:`giving-schedule-${row.correlation_key}`})
          local = (await db.query<{id:number;provider_schedule_id:string;status:string}>(`INSERT INTO giving_schedules(context_key,environment,synthetic,checkout_id,giver_id,consent_id,payment_provider,provider_schedule_id,status,frequency,amount_minor,transaction_fee_minor,next_payment_date,provider_status,provider_verified_at,provider_source)
            VALUES($1,$2,$3,$4,$5,NULL,'stripe',$6,'active',$7,$8,$9,$10,$11,now(),'reconciliation') RETURNING id,provider_schedule_id,status`, [row.context_key,row.environment,row.synthetic,row.id,row.giver_id,schedule.id,row.frequency,row.amount_minor,row.transaction_fee_minor,new Date((row.first_payment_immediate?nextGivingAnchor(start,row.frequency as GivingCheckoutSubmission['frequency']):start)*1000).toISOString(),schedule.status])).rows[0]
        }
        if (schedule.metadata?.ev_checkout_version !== row.submission_digest || stripeObjectId(schedule.customer) !== row.customer_id || schedule.livemode !== (row.environment === 'production')) throw new Error('Stripe schedule mismatch')
        if(schedule.phases.length!==(row.first_payment_immediate?2:1))throw new Error('Stripe schedule phase mismatch')
        const interval = recurringInterval(row.frequency)
        let expectedPrice: string | null = null
        for(const phase of schedule.phases) {
          const item=phase.items[0]
          if(phase.items.length!==1 || item.quantity!==1 || item.discounts?.length)throw new Error('Stripe schedule items mismatch')
          const priceId=stripeObjectId(item.price)!
          if(expectedPrice && expectedPrice!==priceId)throw new Error('Stripe recurring price changed between phases')
          expectedPrice=priceId
          const price=await stripe.prices.retrieve(priceId)
          if(price.currency!=='nzd' || price.unit_amount!==Number(row.amount_minor)+Number(row.transaction_fee_minor) || price.recurring?.interval!==interval.interval || price.recurring.interval_count!==interval.interval_count)throw new Error('Stripe schedule amount mismatch')
        }
        if(row.first_payment_immediate) {
          const date=String(row.first_payment_date).slice(0,10)
          const anchor=givingAnchorTimestamp(date)
          const first=schedule.phases[0], ongoing=schedule.phases[1]
          if(first.start_date!==anchor || first.end_date!==nextGivingAnchor(anchor,row.frequency as GivingCheckoutSubmission['frequency']) || ongoing.start_date!==first.end_date || first.discounts.length!==1 || ongoing.discounts.length!==0 || ongoing.billing_cycle_anchor!=='automatic')throw new Error('First-paid period is not correctly bounded')
          const couponId=stripeObjectId(first.discounts[0].coupon)
          if(!couponId)throw new Error('First-paid credit missing')
          const coupon=await stripe.coupons.retrieve(couponId)
          if(coupon.percent_off!==100 || coupon.duration!=='forever' || coupon.metadata?.ev_checkout_version!==row.submission_digest)throw new Error('First-paid credit mismatch')
          await recordCharge(db,stripe,row,initialCharge!,local.id)
        }
        let subscriptionId = stripeObjectId(schedule.subscription) ?? stripeObjectId(schedule.released_subscription) ?? row.subscription_id
        if (!subscriptionId && !['not_started'].includes(schedule.status)) {
          const candidates=await stripe.subscriptions.list({customer:row.customer_id!,status:'all',limit:100})
          subscriptionId=candidates.data.find(item=>item.metadata.ev_checkout_id===String(row.id) && item.metadata.ev_checkout_version===row.submission_digest)?.id ?? null
          if(!subscriptionId && candidates.has_more)throw new Error('Stripe subscription needs reconciliation')
        }
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          if (subscription.metadata.ev_checkout_version !== row.submission_digest || stripeObjectId(subscription.customer) !== row.customer_id) throw new Error('Stripe subscription mismatch')
          await db.query('UPDATE giving_stripe_sessions SET subscription_id=$2 WHERE checkout_id=$1',[row.id,subscriptionId])
          const next = subscription.items.data[0]?.current_period_end
          const stopped = ['canceled','unpaid'].includes(subscription.status) || schedule.status === 'canceled'
          await db.query(`UPDATE giving_schedules SET status=CASE WHEN $2='cancelled' THEN 'cancelled' WHEN status IN ('cancel_pending','cancelled','failed') THEN status ELSE $2 END,next_payment_date=COALESCE(to_timestamp($3),next_payment_date),provider_status=$4,provider_verified_at=now(),updated_at=now() WHERE id=$1`,[local.id,stopped?'cancelled':'active',next??null,subscription.status])
          if (stopped) {
            await db.query("UPDATE giving_email_deliveries SET status='skipped',error_code='arrangement-stopped',updated_at=now() WHERE checkout_id=$1 AND kind IN ('stripe-failed','stripe-action') AND status='pending'",[row.id])
            await queueNotice(db,row.id,'stripe-stopped',row.correlation_key)
          }
          for await (const invoice of stripe.invoices.list({subscription:subscriptionId,limit:100})) {
            if(invoice.currency!=='nzd')throw new Error('Stripe invoice currency mismatch')
            if(row.first_payment_immediate && invoice.billing_reason==='subscription_create' && invoice.total===0 && invoice.amount_paid===0)continue
            if (invoice.currency !== 'nzd' || invoice.total !== Number(row.amount_minor)+Number(row.transaction_fee_minor)) throw new Error('Stripe invoice total mismatch')
            if (invoice.status === 'paid' && invoice.amount_paid === invoice.total) {
              const recorded=(await db.query("SELECT 1 FROM giving_gifts WHERE environment=$1 AND payment_provider='stripe' AND checkout_id=$2 AND provider_invoice_id=$3 AND status='settled' AND processing_fee_minor IS NOT NULL",[row.environment,row.id,invoice.id])).rowCount
              if(recorded)continue
              await db.query("UPDATE giving_email_deliveries SET status='skipped',error_code='payment-recovered',updated_at=now() WHERE checkout_id=$1 AND event_key=$2 AND kind IN ('stripe-failed','stripe-action') AND status='pending'",[row.id,invoice.id])
              const payments = await stripe.invoicePayments.list({invoice:invoice.id,limit:100})
              if (payments.has_more) throw new Error('Stripe invoice payment needs reconciliation')
              for (const payment of payments.data) {
                const intentId = stripeObjectId(payment.payment.payment_intent)
                if (!intentId || payment.status !== 'paid') continue
                const intent = await stripe.paymentIntents.retrieve(intentId)
                if (intent.status !== 'succeeded') throw new Error('Stripe invoice payment not successful')
                await recordCharge(db,stripe,row,stripeObjectId(intent.latest_charge)!,local.id,invoice.id)
              }
            } else if (invoice.attempt_count > 0 && invoice.status === 'open') {
              if (stopped) await stripe.invoices.voidInvoice(invoice.id,{},{idempotencyKey:`giving-void-${invoice.id}`})
              else {
                const payments = await stripe.invoicePayments.list({invoice:invoice.id,limit:100})
                let requiresAction = false
                for (const payment of payments.data) {
                  const intentId = stripeObjectId(payment.payment.payment_intent)
                  if (intentId) {
                    const intent = await stripe.paymentIntents.retrieve(intentId)
                    requiresAction ||= intent.status === 'requires_action' || ['lost_card','stolen_card','incorrect_number','authentication_required','revocation_of_authorization','revocation_of_all_authorizations','transaction_not_allowed'].includes(intent.last_payment_error?.decline_code ?? '')
                  }
                }
                await queueNotice(db,row.id,requiresAction ? 'stripe-action':'stripe-failed',invoice.id,requiresAction ? invoice.hosted_invoice_url : undefined)
              }
            }
          }
        } else if (['canceled','aborted'].includes(schedule.status)) {
          await db.query("UPDATE giving_schedules SET status='cancelled',provider_status='canceled',provider_verified_at=now(),updated_at=now() WHERE id=$1",[local.id])
          await queueNotice(db,row.id,'stripe-stopped',row.correlation_key)
        }
        if (['active','not_started','released'].includes(schedule.status)) await complete(db,row)
      }
    }
    await db.query('COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
}

async function complete(db: PoolClient, row: StripeCheckoutRow) {
  const transitioned = await db.query("UPDATE giving_checkouts SET status='completed',result_code='verified',updated_at=now() WHERE id=$1 AND status<>'completed' RETURNING id",[row.id])
  if (transitioned.rowCount === 1) await queueGivingCompletionEmails(db,row.id,'stripe')
}

export async function stripeGivingStatus(pool: Pool, token: string): Promise<GivingCheckoutStatus | null> {
  const repository = createPostgresGivingCheckoutRepository(pool)
  let checkout = await repository.findByStatusCapability(capabilityDigest('status',token),new Date())
  if (!checkout || (await pool.query('SELECT 1 FROM giving_stripe_sessions WHERE checkout_id=$1',[checkout.id])).rowCount !== 1) return null
  if (checkout.status !== 'completed' && checkout.status !== 'failed') {
    try { await reconcileStripeCheckout(pool,checkout.id) } catch { /* leave unresolved rather than infer success */ }
    checkout = (await repository.get(checkout.id))!
  }
  return {state:checkout.status==='completed'?'verified':checkout.status==='failed'?'expired':'processing',retryAllowed:checkout.status==='failed',kind:checkout.frequency==='one-off'?'one-off':'recurring',firstName:checkout.giverFirstName,
    gift:{amountMinor:checkout.amountMinor,transactionFeeMinor:checkout.transactionFeeMinor,fundName:checkout.fundName,frequency:checkout.frequency,firstPaymentDate:checkout.firstPaymentDate}}
}
