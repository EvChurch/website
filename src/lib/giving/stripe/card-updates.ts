import type { Pool } from 'pg'
import type { GivingEnvironment } from '../contracts'
import { getGivingStripe } from './config'
import { stripeObjectId } from './service'

/** Serialize all card mutations for a schedule, independently of webhook delivery order. */
export async function applyStripeCardUpdate(pool: Pool, environment: GivingEnvironment, sessionId: string, scheduleId: number) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const target = (await db.query<{provider_schedule_id:string;status:string}>(`SELECT provider_schedule_id,status FROM giving_schedules
      WHERE id=$1 AND environment=$2 AND payment_provider='stripe' FOR UPDATE`,[scheduleId,environment])).rows[0]
    if (!target || target.status !== 'active') { await db.query('COMMIT'); return }
    const update = (await db.query<{version:string;customer_id:string;applied_at:Date|null;superseded:boolean;session_id:string|null}>(`SELECT version,customer_id,applied_at,superseded,session_id
      FROM giving_stripe_card_updates WHERE schedule_id=$1 AND environment=$2 ORDER BY version DESC LIMIT 1`,[scheduleId,environment])).rows[0]
    if (!update || update.session_id !== sessionId || update.superseded || update.applied_at) { await db.query('COMMIT'); return }
    const stripe = getGivingStripe(environment)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status !== 'complete') { await db.query('COMMIT'); return }
    if (session.mode !== 'setup' || session.livemode !== (environment === 'production') || stripeObjectId(session.customer) !== update.customer_id ||
        session.metadata?.ev_card_update !== String(scheduleId) || session.metadata.ev_card_update_version !== String(update.version)) throw new Error('Card update mismatch')
    const setup = await stripe.setupIntents.retrieve(stripeObjectId(session.setup_intent)!)
    const method = stripeObjectId(setup.payment_method)
    if (setup.status !== 'succeeded' || stripeObjectId(setup.customer) !== update.customer_id || !method) throw new Error('Card update not authorised')
    const schedule = await stripe.subscriptionSchedules.retrieve(target.provider_schedule_id)
    if (schedule.livemode !== (environment === 'production') || stripeObjectId(schedule.customer) !== update.customer_id) throw new Error('Card update owner mismatch')
    if (schedule.status === 'not_started' || schedule.status === 'active') await stripe.subscriptionSchedules.update(schedule.id,{default_settings:{default_payment_method:method}},{idempotencyKey:`giving-card-${session.id}`})
    const subscription = stripeObjectId(schedule.subscription) ?? stripeObjectId(schedule.released_subscription)
    if (subscription) await stripe.subscriptions.update(subscription,{default_payment_method:method},{idempotencyKey:`giving-card-sub-${session.id}`})
    await db.query('UPDATE giving_stripe_card_updates SET applied_at=now() WHERE version=$1',[update.version])
    await db.query('COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
}
