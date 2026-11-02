import type { Pool, PoolClient } from 'pg'
import type Stripe from 'stripe'
import type { GivingEnvironment } from '../contracts'
import { getGivingStripe } from './config'
import { stripeObjectId } from './service'

/** Called while the gift row is locked, so concurrent observations cannot roll refunds back. */
export async function recordStripeRefunds(db: PoolClient, stripe: Stripe, giftId: number, environment: GivingEnvironment, charge: Stripe.Charge) {
  let refunded = 0
  let pending = 0
  const seen = new Set<string>()
  for await (const refund of stripe.refunds.list({ charge: charge.id, limit: 100 })) {
    if (stripeObjectId(refund.charge) !== charge.id || refund.currency !== 'nzd' || !refund.status ||
        !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || seen.has(refund.id)) throw new Error('Stripe refund provenance mismatch')
    seen.add(refund.id)
    if (refund.status === 'succeeded') refunded += refund.amount
    if (refund.status === 'pending' || refund.status === 'requires_action') pending += refund.amount
    const stored = await db.query(`INSERT INTO giving_stripe_refunds(environment,refund_id,gift_id,charge_id,amount_minor,status,balance_transaction_id,provider_created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,to_timestamp($8))
      ON CONFLICT(environment,refund_id) DO UPDATE SET status=EXCLUDED.status,balance_transaction_id=EXCLUDED.balance_transaction_id,verified_at=now()
      WHERE giving_stripe_refunds.gift_id=EXCLUDED.gift_id AND giving_stripe_refunds.charge_id=EXCLUDED.charge_id AND giving_stripe_refunds.amount_minor=EXCLUDED.amount_minor RETURNING refund_id`,
    [environment,refund.id,giftId,charge.id,refund.amount,refund.status,stripeObjectId(refund.balance_transaction),refund.created])
    if (stored.rowCount !== 1) throw new Error('Stripe refund reference conflict')
  }
  if (!Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || refunded + pending < charge.amount_refunded) throw new Error('Stripe refund list incomplete')
  if (!Number.isSafeInteger(refunded + pending) || refunded + pending > charge.amount) throw new Error('Stripe refund total mismatch')
  // An incomplete provider list must not erase an adjustment we have already recorded.
  const missing = await db.query('SELECT 1 FROM giving_stripe_refunds WHERE gift_id=$1 AND NOT(refund_id=ANY($2::varchar[])) LIMIT 1',[giftId,[...seen]])
  if (missing.rowCount) throw new Error('Stripe refund list incomplete')
  await db.query('UPDATE giving_gifts SET refunded_minor=$2,refund_pending_minor=$3,refunds_verified_at=now() WHERE id=$1',[giftId,refunded,pending])
}

export async function reconcileStripeRefunds(pool: Pool, environment: GivingEnvironment, chargeId: string) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const gift = (await db.query<{id:number;customer_id:string;amount_minor:string;transaction_fee_minor:string}>(`SELECT gift.id,session.customer_id,gift.amount_minor,gift.transaction_fee_minor
      FROM giving_gifts gift JOIN giving_stripe_sessions session ON session.checkout_id=gift.checkout_id
      WHERE gift.environment=$1 AND gift.payment_provider='stripe' AND gift.provider_charge_id=$2 FOR UPDATE OF gift`,[environment,chargeId])).rows[0]
    if (!gift) throw new Error('Refunded gift not yet reconciled')
    const stripe = getGivingStripe(environment)
    const charge = await stripe.charges.retrieve(chargeId)
    if (charge.id !== chargeId || charge.currency !== 'nzd' || charge.livemode !== (environment === 'production') ||
        stripeObjectId(charge.customer) !== gift.customer_id || charge.amount !== Number(gift.amount_minor)+Number(gift.transaction_fee_minor)) throw new Error('Stripe refund charge mismatch')
    await recordStripeRefunds(db,stripe,gift.id,environment,charge)
    await db.query('COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
}
