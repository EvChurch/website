import type { Pool } from 'pg'
import type { GivingEnvironment } from '../contracts'
import { getGivingStripe } from './config'
import { stripeObjectId } from './service'

interface CardUpdate {
  version: string
  customer_id: string
  session_id: string | null
  applied_at: Date | null
  superseded: boolean
  payment_method_id: string | null
}

/** Fence ambiguous provider mutations before applying a newer card, even after worker death. */
export async function applyStripeCardUpdate(pool: Pool, environment: GivingEnvironment, sessionId: string, scheduleId: number) {
  const db = await pool.connect()
  let locked = false
  let transaction = false
  try {
    await db.query('SELECT pg_advisory_lock(31332,$1::integer)',[scheduleId])
    locked = true
    const stripe = getGivingStripe(environment)
    const target = (await db.query<{provider_schedule_id:string;status:string}>(`SELECT provider_schedule_id,status FROM giving_schedules
      WHERE id=$1 AND environment=$2 AND payment_provider='stripe'`,[scheduleId,environment])).rows[0]
    if (!target || target.status !== 'active') return

    async function finish(update: CardUpdate) {
      if (!update.session_id || !update.payment_method_id) throw new Error('Card update operation missing')
      const schedule = await stripe.subscriptionSchedules.retrieve(target.provider_schedule_id)
      if (schedule.livemode !== (environment === 'production') || stripeObjectId(schedule.customer) !== update.customer_id) throw new Error('Card update owner mismatch')
      if (schedule.status === 'not_started' || schedule.status === 'active') await stripe.subscriptionSchedules.update(schedule.id,{default_settings:{default_payment_method:update.payment_method_id}},{idempotencyKey:`giving-card-${update.session_id}`})
      const subscription = stripeObjectId(schedule.subscription) ?? stripeObjectId(schedule.released_subscription)
      if (subscription) await stripe.subscriptions.update(subscription,{default_payment_method:update.payment_method_id},{idempotencyKey:`giving-card-sub-${update.session_id}`})
      await db.query('UPDATE giving_stripe_card_updates SET applied_at=now() WHERE version=$1',[update.version])
    }

    // Repeating the exact idempotent request waits for/recovers an earlier ambiguous
    // operation. Never let its delayed completion race a newer selected card.
    const unresolved = (await db.query<CardUpdate>(`SELECT * FROM giving_stripe_card_updates WHERE schedule_id=$1 AND environment=$2
      AND application_started_at IS NOT NULL AND applied_at IS NULL ORDER BY version`,[scheduleId,environment])).rows
    for (const update of unresolved) await finish(update)

    await db.query('BEGIN')
    transaction = true
    const active = (await db.query(`SELECT id FROM giving_schedules WHERE id=$1 AND status='active' FOR UPDATE`,[scheduleId])).rowCount
    const update = (await db.query<CardUpdate>(`SELECT * FROM giving_stripe_card_updates WHERE schedule_id=$1 AND environment=$2 ORDER BY version DESC LIMIT 1`,[scheduleId,environment])).rows[0]
    if (!active || !update || update.session_id !== sessionId || update.superseded || update.applied_at) {
      await db.query('COMMIT'); transaction = false; return
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status !== 'complete') { await db.query('COMMIT'); transaction = false; return }
    if (session.mode !== 'setup' || session.livemode !== (environment === 'production') || stripeObjectId(session.customer) !== update.customer_id ||
        session.metadata?.ev_card_update !== String(scheduleId) || session.metadata.ev_card_update_version !== String(update.version)) throw new Error('Card update mismatch')
    const setup = await stripe.setupIntents.retrieve(stripeObjectId(session.setup_intent)!)
    const method = stripeObjectId(setup.payment_method)
    if (setup.status !== 'succeeded' || stripeObjectId(setup.customer) !== update.customer_id || !method) throw new Error('Card update not authorised')
    await db.query('UPDATE giving_stripe_card_updates SET application_started_at=now(),payment_method_id=$2 WHERE version=$1',[update.version,method])
    await db.query('COMMIT')
    transaction = false
    // The operation marker survives an API timeout or process crash. The session
    // advisory lock serializes provider writes across this transaction boundary.
    await finish({...update,payment_method_id:method})
  } catch (error) {
    if (transaction) await db.query('ROLLBACK')
    throw error
  } finally {
    if (locked) await db.query('SELECT pg_advisory_unlock(31332,$1::integer)',[scheduleId])
    db.release()
  }
}
