import type { GivingEnvironment } from '../contracts'
import type { GivingCancellationProvider } from '../cancellation'
import { getBlinkPayRuntimeClient } from '../blinkpay/runtime-client'
import { getGivingStripe } from './config'
import { stopStripeSchedule } from './lifecycle'
import { stripeObjectId } from './service'

export function getGivingCancellationProvider(environment:GivingEnvironment, provider:'blinkpay'|'stripe'='blinkpay'):GivingCancellationProvider {
  if(provider==='blinkpay')return getBlinkPayRuntimeClient(environment)
  return {
    async cancelFixedRecurringPayment(id,keys) {
      try {
        await stopStripeSchedule(environment,id)
        return {outcome:'succeeded',value:undefined,metadata:{requestId:keys.requestId,idempotencyKey:keys.idempotencyKey}}
      } catch {
        return {outcome:'unknown',reason:'request-ambiguous',metadata:{requestId:keys.requestId,idempotencyKey:keys.idempotencyKey}}
      }
    },
    async getFixedRecurringPayment(id) {
      const stripe=getGivingStripe(environment)
      const schedule=await stripe.subscriptionSchedules.retrieve(id)
      const sub=stripeObjectId(schedule.subscription)??stripeObjectId(schedule.released_subscription)
      const cancelled=schedule.status==='canceled' || sub && (await stripe.subscriptions.retrieve(sub)).status==='canceled'
      if (cancelled) await stopStripeSchedule(environment,id)
      return {status:cancelled?'cancelled':schedule.status}
    },
  }
}
