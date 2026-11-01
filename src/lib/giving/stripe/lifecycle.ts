import { createHash } from 'node:crypto'
import type { Pool } from 'pg'
import type Stripe from 'stripe'
import type { GivingEnvironment } from '../contracts'
import { getGivingStripe } from './config'
import { reconcileStripeCheckout, stripeObjectId } from './service'

export async function storeStripeEvent(pool: Pool, environment: GivingEnvironment, event: Stripe.Event, raw: string) {
  if (event.livemode !== (environment === 'production')) throw new Error('Stripe environment mismatch')
  const digest = createHash('sha256').update(raw).digest('hex')
  await pool.query(`INSERT INTO giving_stripe_events(environment,event_id,event_type,payload_digest,payload) VALUES($1,$2,$3,$4,$5::jsonb)
    ON CONFLICT(environment,event_id) DO UPDATE SET status=CASE WHEN giving_stripe_events.payload_digest=EXCLUDED.payload_digest THEN giving_stripe_events.status ELSE 'quarantined' END,
    last_error=CASE WHEN giving_stripe_events.payload_digest=EXCLUDED.payload_digest THEN giving_stripe_events.last_error ELSE 'conflicting-event' END`,[environment,event.id,event.type,digest,JSON.stringify(event)])
}

async function handleStripeEvent(pool: Pool, environment: GivingEnvironment, event: Stripe.Event) {
  const stripe = getGivingStripe(environment)
  if (event.type.startsWith('payout.')) {
    const object = event.data.object
    if (object.object !== 'payout') return
    const payout = await stripe.payouts.retrieve(object.id)
    if (payout.livemode !== (environment === 'production') || payout.currency !== 'nzd') throw new Error('Payout environment mismatch')
    await pool.query("UPDATE giving_stripe_balances SET payout_status=$3 WHERE environment=$1 AND payout_id=$2",[environment,payout.id,payout.status])
    await pool.query("UPDATE giving_gifts SET payout_status=$3 WHERE environment=$1 AND payment_provider='stripe' AND payout_id=$2",[environment,payout.id,payout.status])
    if (payout.status !== 'paid') return
    for await (const balance of stripe.balanceTransactions.list({payout:payout.id,limit:100})) {
      const chargeId = stripeObjectId(balance.source)
      if (chargeId?.startsWith('ch_')) {
        await pool.query(`INSERT INTO giving_stripe_balances(environment,charge_id,payout_id,fee_minor,net_minor,payout_status) VALUES($1,$2,$3,$4,$5,'paid') ON CONFLICT(environment,charge_id) DO UPDATE SET payout_id=EXCLUDED.payout_id,fee_minor=EXCLUDED.fee_minor,net_minor=EXCLUDED.net_minor,payout_status='paid'`,[environment,chargeId,payout.id,balance.fee,balance.net])
        await pool.query(`UPDATE giving_gifts SET payout_id=$1,payout_status='paid',processing_fee_minor=$2,net_minor=$3 WHERE environment=$4 AND payment_provider='stripe' AND provider_charge_id=$5`,[payout.id,balance.fee,balance.net,environment,chargeId])
      }
    }
    return
  }
  if (event.type.startsWith('charge.dispute.')) {
    const object = event.data.object
    if (object.object !== 'dispute') return
    const dispute = await stripe.disputes.retrieve(object.id)
    const chargeId = stripeObjectId(dispute.charge)
    const charge = await stripe.charges.retrieve(chargeId!)
    if (charge.livemode !== (environment==='production')) throw new Error('Dispute environment mismatch')
    const owner = (await pool.query<{checkout_id:number}>('SELECT s.checkout_id FROM giving_stripe_sessions s JOIN giving_checkouts c ON c.id=s.checkout_id WHERE s.customer_id=$1 AND c.environment=$2',[stripeObjectId(charge.customer),environment])).rows[0]
    if (!owner) return // An unrelated payment in the same Stripe account.
    await reconcileStripeCheckout(pool,owner.checkout_id)
    const gift = (await pool.query<{checkout_id:number;schedule_id:number|null}>("UPDATE giving_gifts SET dispute_status=$3 WHERE environment=$1 AND payment_provider='stripe' AND provider_charge_id=$2 RETURNING checkout_id,schedule_id",[environment,chargeId,dispute.status])).rows[0]
    if (!gift) throw new Error('Disputed gift not yet reconciled')
    if (gift.schedule_id && dispute.status !== 'won') {
      const schedule = (await pool.query<{provider_schedule_id:string}>("SELECT provider_schedule_id FROM giving_schedules WHERE id=$1 AND payment_provider='stripe'",[gift.schedule_id])).rows[0]
      if (schedule) await stopStripeSchedule(environment,schedule.provider_schedule_id)
      await pool.query("UPDATE giving_schedules SET status='cancelled',provider_status='disputed',provider_verified_at=now(),updated_at=now() WHERE id=$1",[gift.schedule_id])
    }
    // Stripe Dashboard dispute notifications remain the staff action channel. No refund is initiated here.
    return
  }
  const object = event.data.object
  if (object.object === 'checkout.session') {
    const update = (await pool.query<{schedule_id:number;customer_id:string}>("SELECT schedule_id,customer_id FROM giving_stripe_card_updates WHERE session_id=$1 AND environment=$2",[object.id,environment])).rows[0]
    if (update) {
      const session = await stripe.checkout.sessions.retrieve(object.id)
      if (session.status !== 'complete') return
      if (session.mode !== 'setup' || session.livemode !== (environment==='production') || stripeObjectId(session.customer)!==update.customer_id) throw new Error('Card update mismatch')
      const setup = await stripe.setupIntents.retrieve(stripeObjectId(session.setup_intent)!)
      if (setup.status!=='succeeded' || stripeObjectId(setup.customer)!==update.customer_id) throw new Error('Card update not authorised')
      const target = (await pool.query<{provider_schedule_id:string;status:string}>("SELECT provider_schedule_id,status FROM giving_schedules WHERE id=$1 AND payment_provider='stripe'",[update.schedule_id])).rows[0]
      if (!target || target.status!=='active') return
      const schedule = await stripe.subscriptionSchedules.retrieve(target.provider_schedule_id)
      const method = stripeObjectId(setup.payment_method)!
      if (stripeObjectId(schedule.customer)!==update.customer_id) throw new Error('Card update owner mismatch')
      if (schedule.status === 'not_started' || schedule.status === 'active') await stripe.subscriptionSchedules.update(schedule.id,{default_settings:{default_payment_method:method}},{idempotencyKey:`giving-card-${session.id}`})
      const subscription = stripeObjectId(schedule.subscription) ?? stripeObjectId(schedule.released_subscription)
      if (subscription) await stripe.subscriptions.update(subscription,{default_payment_method:method},{idempotencyKey:`giving-card-sub-${session.id}`})
      return
    }
    const id = Number(object.metadata?.ev_checkout_id)
    if (Number.isSafeInteger(id) && id>0) await reconcileStripeCheckout(pool,id,object.id)
    return
  }
  let customer: string | null = null
  if ('customer' in object) customer = stripeObjectId(object.customer)
  if (!customer) return
  const row = (await pool.query<{checkout_id:number}>(`SELECT s.checkout_id FROM giving_stripe_sessions s JOIN giving_checkouts c ON c.id=s.checkout_id WHERE s.customer_id=$1 AND c.environment=$2 AND c.payment_provider='stripe'`,[customer,environment])).rows[0]
  if (row) await reconcileStripeCheckout(pool,row.checkout_id)
}

/** Stop future collections without a final prorated charge or collecting unpaid gifts. */
export async function stopStripeSchedule(environment: GivingEnvironment, id: string) {
  const stripe = getGivingStripe(environment)
  const schedule = await stripe.subscriptionSchedules.retrieve(id)
  if (schedule.livemode !== (environment==='production')) throw new Error('Stripe cancellation environment mismatch')
  if (schedule.status==='active' || schedule.status==='not_started') await stripe.subscriptionSchedules.cancel(id,{invoice_now:false,prorate:false},{idempotencyKey:`giving-stop-${id}`})
  let subscriptionId = stripeObjectId(schedule.subscription) ?? stripeObjectId(schedule.released_subscription)
  const metadata=schedule.metadata
  if (!subscriptionId && metadata?.ev_checkout_id) {
    const candidates=await stripe.subscriptions.list({customer:stripeObjectId(schedule.customer)!,status:'all',limit:100})
    subscriptionId=candidates.data.find(item=>item.metadata.ev_checkout_id===metadata.ev_checkout_id && item.metadata.ev_checkout_version===metadata.ev_checkout_version)?.id ?? null
    if (!subscriptionId && candidates.has_more) throw new Error('Cancellation needs subscription reconciliation')
  }
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.status!=='canceled') await stripe.subscriptions.cancel(subscriptionId,{invoice_now:false,prorate:false},{idempotencyKey:`giving-stop-${subscriptionId}`})
    for await (const invoice of stripe.invoices.list({subscription:subscriptionId,status:'open',limit:100})) {
      await stripe.invoices.voidInvoice(invoice.id,{},{idempotencyKey:`giving-void-${invoice.id}`})
    }
    for await (const invoice of stripe.invoices.list({subscription:subscriptionId,status:'draft',limit:100})) await stripe.invoices.del(invoice.id)
    const open=await stripe.invoices.list({subscription:subscriptionId,status:'open',limit:1})
    const draft=await stripe.invoices.list({subscription:subscriptionId,status:'draft',limit:1})
    if(open.data.length || draft.data.length)throw new Error('Cancellation invoice cleanup is incomplete')
  }
}

export async function reconcileStripeGiving(pool: Pool) {
  const events = (await pool.query<{id:number;environment:GivingEnvironment;payload:Stripe.Event}>("SELECT id,environment,payload FROM giving_stripe_events WHERE status='pending' AND next_attempt_at<=now() ORDER BY next_attempt_at,id LIMIT 100")).rows
  let processed=0
  let failures=0
  for (const event of events) {
    const lock = await pool.connect()
    let acquired=false
    try {
      acquired=Boolean((await lock.query<{locked:boolean}>('SELECT pg_try_advisory_lock(31331,$1::integer) locked',[event.id])).rows[0].locked)
      if (!acquired) continue
      const pending=(await lock.query("SELECT 1 FROM giving_stripe_events WHERE id=$1 AND status='pending'",[event.id])).rowCount
      if (!pending) continue
      await handleStripeEvent(pool,event.environment,event.payload)
      await lock.query("UPDATE giving_stripe_events SET status='processed',processed_at=now(),attempts=attempts+1,last_error=NULL WHERE id=$1 AND status='pending'",[event.id])
      processed++
    } catch {
      failures++
      await lock.query("UPDATE giving_stripe_events SET attempts=attempts+1,last_attempt_at=now(),next_attempt_at=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(attempts,7)))::integer),last_error='processing-failed' WHERE id=$1",[event.id])
    } finally {
      if(acquired) await lock.query('SELECT pg_advisory_unlock(31331,$1::integer)',[event.id])
      lock.release()
    }
  }
  const cancellations = (await pool.query<{id:number;schedule_id:number;environment:GivingEnvironment;provider_schedule_id:string}>(`SELECT operation.id,operation.schedule_id,operation.environment,schedule.provider_schedule_id FROM giving_provider_operations operation JOIN giving_schedules schedule ON schedule.id=operation.schedule_id AND schedule.checkout_id=operation.checkout_id
    WHERE operation.provider='stripe' AND operation.action='stripe.cancel-schedule' AND operation.status IN ('submitted','unknown') ORDER BY operation.updated_at LIMIT 100`)).rows
  for (const cancellation of cancellations) {
    try {
      await stopStripeSchedule(cancellation.environment,cancellation.provider_schedule_id)
      const db=await pool.connect()
      try {
        await db.query('BEGIN')
        const operation=await db.query("UPDATE giving_provider_operations SET status='succeeded',updated_at=now() WHERE id=$1 AND status IN ('submitted','unknown') RETURNING id",[cancellation.id])
        if(operation.rowCount) {
          await db.query(`INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome) SELECT $1,COALESCE(MAX(attempt_number),0)+1,'succeeded' FROM giving_provider_operation_attempts WHERE operation_id=$1`,[cancellation.id])
          await db.query("UPDATE giving_schedules SET status='cancelled',provider_status='canceled',provider_verified_at=now(),provider_source='reconciliation',updated_at=now() WHERE id=$1",[cancellation.schedule_id])
        }
        await db.query('COMMIT')
      } catch(error) {await db.query('ROLLBACK');throw error} finally {db.release()}
    } catch {failures++;await pool.query('UPDATE giving_provider_operations SET updated_at=now() WHERE id=$1',[cancellation.id])}
  }
  const checkouts=(await pool.query<{checkout_id:number;session_id:string|null;customer_id:string|null;environment:GivingEnvironment}>(`SELECT s.checkout_id,s.session_id,s.customer_id,c.environment FROM giving_stripe_sessions s JOIN giving_checkouts c ON c.id=s.checkout_id
    WHERE c.status<>'failed' AND (c.frequency<>'one-off' OR c.status<>'completed' OR NOT EXISTS(SELECT 1 FROM giving_gifts g WHERE g.checkout_id=c.id AND g.payment_provider='stripe' AND g.processing_fee_minor IS NOT NULL)) ORDER BY s.last_attempt_at ASC NULLS FIRST,s.checkout_id LIMIT 100`)).rows
  for (const item of checkouts) {
    try {
      let sessionId=item.session_id
      if(!sessionId && item.customer_id) {
        const sessions=await getGivingStripe(item.environment).checkout.sessions.list({customer:item.customer_id,limit:100})
        sessionId=sessions.data.find(session=>session.metadata?.ev_checkout_id===String(item.checkout_id))?.id ?? null
      }
      await reconcileStripeCheckout(pool,item.checkout_id,sessionId??undefined)
    } catch { failures++ } finally { await pool.query('UPDATE giving_stripe_sessions SET last_attempt_at=now() WHERE checkout_id=$1',[item.checkout_id]) }
  }
  // A payout and gift can commit concurrently. Join the durable association again after
  // observation processing so a zero-row payout update never loses the relationship.
  await pool.query(`UPDATE giving_gifts gift SET payout_id=balance.payout_id,payout_status=balance.payout_status,processing_fee_minor=balance.fee_minor,net_minor=balance.net_minor
    FROM giving_stripe_balances balance WHERE gift.payment_provider='stripe' AND gift.environment=balance.environment AND gift.provider_charge_id=balance.charge_id
    AND (gift.payout_id IS DISTINCT FROM balance.payout_id OR gift.payout_status IS DISTINCT FROM balance.payout_status OR gift.processing_fee_minor IS DISTINCT FROM balance.fee_minor OR gift.net_minor IS DISTINCT FROM balance.net_minor)`)
  return {processed,failures}
}
