import type { Payload } from 'payload'
import { getBlinkPayRuntimeClient } from '@/lib/giving/blinkpay/runtime-client'
import { cleanupGivingDrafts } from '@/lib/giving/drafts'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { createGivingLifecycleProcessor, createPostgresGivingLifecycleStore, createUnknownCancellationReconciler, runGivingReconciliation } from '@/lib/giving/reconciliation'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'

function runtime(payload: Payload) {
  const pool = requireGivingPostgresPool(payload)
  const store = createPostgresGivingLifecycleStore(pool)
  const provider = getBlinkPayRuntimeClient
  const processor = createGivingLifecycleProcessor({ store, provider })
  const checkoutService = createGivingCheckoutService({
    repository: createPostgresGivingCheckoutRepository(pool),
    blinkPay: provider,
    digestSecret: process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? '',
    resolveIdentity: async () => { throw new Error('Lifecycle jobs never resolve giver identity') },
  })
  return { pool, store, processor, verifyCheckout: checkoutService.verify, continueRecurringCheckout: checkoutService.continueRecurring, reconcileCancellation: createUnknownCancellationReconciler({ store, provider }) }
}

export async function processGivingLifecycleEvent(eventId: number, payload: Payload) {
  return runtime(payload).processor.process(eventId)
}

export async function reconcileGivingLifecycle(payload: Payload) {
  const dependencies = runtime(payload)
  const reconciliation = await runGivingReconciliation({
    store: dependencies.store,
    processEvent: (eventId) => dependencies.processor.process(eventId),
    verifyCheckout: dependencies.verifyCheckout,
    continueRecurringCheckout: dependencies.continueRecurringCheckout,
    reconcileCancellation: dependencies.reconcileCancellation,
  })
  const draftsDeleted = await cleanupGivingDrafts(dependencies.pool)
  return { ...reconciliation, draftsDeleted }
}
