import { Pool } from 'pg'
import type { Payload } from 'payload'
import { createBlinkPayClient } from '@/lib/giving/blinkpay/client'
import { loadBlinkPayConfig } from '@/lib/giving/blinkpay/config'
import type { GivingEnvironment } from '@/lib/giving/contracts'
import { createGivingLifecycleProcessor, createPostgresGivingLifecycleStore, createUnknownCancellationReconciler, runGivingReconciliation } from '@/lib/giving/reconciliation'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'

function poolFromPayload(payload: Payload) {
  return (payload.db as unknown as { pool?: Pool }).pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
}

function runtime(payload: Payload) {
  const pool = poolFromPayload(payload)
  const store = createPostgresGivingLifecycleStore(pool)
  const clients = new Map<GivingEnvironment, ReturnType<typeof createBlinkPayClient>>()
  const provider = (environment: GivingEnvironment) => {
    const existing = clients.get(environment)
    if (existing) return existing
    const created = createBlinkPayClient({ config: loadBlinkPayConfig(environment) })
    clients.set(environment, created)
    return created
  }
  const processor = createGivingLifecycleProcessor({ store, provider })
  const checkoutService = createGivingCheckoutService({
    repository: createPostgresGivingCheckoutRepository(pool),
    blinkPay: provider,
    digestSecret: process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? '',
    resolveIdentity: async () => { throw new Error('Lifecycle jobs never resolve giver identity') },
  })
  return { store, processor, verifyCheckout: checkoutService.verify, continueRecurringCheckout: checkoutService.continueRecurring, reconcileCancellation: createUnknownCancellationReconciler({ store, provider }) }
}

export async function processGivingLifecycleEvent(eventId: number, payload: Payload) {
  return runtime(payload).processor.process(eventId)
}

export async function reconcileGivingLifecycle(payload: Payload) {
  const dependencies = runtime(payload)
  return runGivingReconciliation({
    store: dependencies.store,
    processEvent: (eventId) => dependencies.processor.process(eventId),
    verifyCheckout: dependencies.verifyCheckout,
    continueRecurringCheckout: dependencies.continueRecurringCheckout,
    reconcileCancellation: dependencies.reconcileCancellation,
  })
}
