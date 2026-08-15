import { describe, expect, it, vi } from 'vitest'
import { createGivingLifecycleProcessor, createUnknownCancellationReconciler, runGivingReconciliation } from './reconciliation'

const noCancellations = { unknownCancellationOperations: vi.fn().mockResolvedValue([]), recordCancellationObservation: vi.fn() }

describe('giving lifecycle processing', () => {
  it('treats the event as a prompt and finalizes only an authoritative GET observation', async () => {
    const store = {
      claim: vi.fn().mockResolvedValue({ id: 1, leaseToken: 'lease', referenceType: 'payment', referenceId: 'pay-1', environment: 'sandbox' }),
      finalize: vi.fn().mockResolvedValue(true),
      retry: vi.fn(),
    }
    const getPayment = vi.fn().mockResolvedValue({ payment_id: 'pay-1', status: 'AcceptedSettlementCompleted', status_updated_timestamp: '2026-08-15T12:00:00Z' })
    const result = await createGivingLifecycleProcessor({ store, provider: () => ({ getPayment } as never), now: () => new Date('2026-08-15T12:01:00Z') }).process(1)
    expect(result).toEqual({ status: 'processed' })
    expect(getPayment).toHaveBeenCalledWith('pay-1')
    expect(store.finalize).toHaveBeenCalledWith(expect.objectContaining({ eventId: 1, leaseToken: 'lease', observation: expect.objectContaining({ providerStatus: 'AcceptedSettlementCompleted' }) }))
  })

  it('releases a claimed event for retry when authoritative retrieval fails', async () => {
    const store = { claim: vi.fn().mockResolvedValue({ id: 1, leaseToken: 'lease', referenceType: 'schedule', referenceId: 'schedule-1', environment: 'sandbox' }), finalize: vi.fn(), retry: vi.fn().mockResolvedValue(true) }
    await expect(createGivingLifecycleProcessor({ store, provider: () => ({ getFixedRecurringPayment: vi.fn().mockRejectedValue(new Error('offline')) } as never) }).process(1)).resolves.toEqual({ status: 'retry' })
    expect(store.retry).toHaveBeenCalledWith(1, 'lease', expect.any(Date), 'provider-read-failed')
    expect(store.finalize).not.toHaveBeenCalled()
  })

  it('uses the injected U6 continuation for authorised consents without schedules', async () => {
    const continuation = vi.fn().mockResolvedValue(undefined)
    const verifyCheckout = vi.fn().mockResolvedValue(undefined)
    const store = { ...noCancellations, recoverableEventIds: vi.fn().mockResolvedValue([1, 2]), nonterminalCheckoutIdsWithProviderIds: vi.fn().mockResolvedValue([4, 5]), authorisedConsentsWithoutSchedule: vi.fn().mockResolvedValue([{ checkout: { id: 8 }, providerConsentId: 'consent-8' }]) }
    const process = vi.fn().mockResolvedValue({ status: 'processed' })
    const result = await runGivingReconciliation({ store, processEvent: process, verifyCheckout, continueRecurringCheckout: continuation, reconcileCancellation: vi.fn() })
    expect(process).toHaveBeenCalledTimes(2)
    expect(verifyCheckout.mock.calls).toEqual([[4], [5]])
    expect(continuation).toHaveBeenCalledWith({ id: 8 }, 'consent-8')
    expect(result).toEqual({ events: 2, eventFailures: 0, verifications: 2, verificationFailures: 0, continuations: 1, continuationFailures: 0, cancellations: 0, cancellationFailures: 0 })
  })

  it('continues after one checkout verification and one continuation fail', async () => {
    const store = {
      ...noCancellations,
      recoverableEventIds: vi.fn().mockResolvedValue([]),
      nonterminalCheckoutIdsWithProviderIds: vi.fn().mockResolvedValue([4, 5]),
      authorisedConsentsWithoutSchedule: vi.fn().mockResolvedValue([
        { checkout: { id: 8 }, providerConsentId: 'consent-8' },
        { checkout: { id: 9 }, providerConsentId: 'consent-9' },
      ]),
    }
    const verifyCheckout = vi.fn()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce(undefined)
    const continuation = vi.fn()
      .mockRejectedValueOnce(new Error('poisoned row'))
      .mockResolvedValueOnce(undefined)

    const result = await runGivingReconciliation({ store, processEvent: vi.fn(), verifyCheckout, continueRecurringCheckout: continuation, reconcileCancellation: vi.fn() })

    expect(verifyCheckout.mock.calls).toEqual([[4], [5]])
    expect(continuation.mock.calls).toEqual([[{ id: 8 }, 'consent-8'], [{ id: 9 }, 'consent-9']])
    expect(result).toEqual({ events: 0, eventFailures: 0, verifications: 2, verificationFailures: 1, continuations: 2, continuationFailures: 1, cancellations: 0, cancellationFailures: 0 })
  })

  it('does not retry unknown provider operations that have no provider ID', async () => {
    const store = { ...noCancellations, recoverableEventIds: vi.fn().mockResolvedValue([]), nonterminalCheckoutIdsWithProviderIds: vi.fn().mockResolvedValue([]), authorisedConsentsWithoutSchedule: vi.fn().mockResolvedValue([]) }
    const verifyCheckout = vi.fn()
    await runGivingReconciliation({ store, processEvent: vi.fn(), verifyCheckout, continueRecurringCheckout: vi.fn(), reconcileCancellation: vi.fn() })
    expect(verifyCheckout).not.toHaveBeenCalled()
  })

  it('reconciles unknown cancellations with GET only and isolates per-item failures', async () => {
    const candidates = [
      {operationId:1,scheduleId:11,environment:'sandbox' as const,providerScheduleId:'schedule-11'},
      {operationId:2,scheduleId:12,environment:'sandbox' as const,providerScheduleId:'schedule-12'},
    ]
    const store = { ...noCancellations,unknownCancellationOperations:vi.fn().mockResolvedValue(candidates),recoverableEventIds:vi.fn().mockResolvedValue([]),nonterminalCheckoutIdsWithProviderIds:vi.fn().mockResolvedValue([]),authorisedConsentsWithoutSchedule:vi.fn().mockResolvedValue([]) }
    const reconcileCancellation=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true)
    const result=await runGivingReconciliation({store,processEvent:vi.fn(),verifyCheckout:vi.fn(),continueRecurringCheckout:vi.fn(),reconcileCancellation})
    expect(reconcileCancellation.mock.calls).toEqual([[candidates[0]],[candidates[1]]])
    expect(result).toMatchObject({cancellations:2,cancellationFailures:1})
  })

  it('uses one authoritative GET and records cancelled or still-unknown without DELETE', async () => {
    const recordCancellationObservation=vi.fn().mockResolvedValue(true)
    const store={...noCancellations,recordCancellationObservation} as never
    const getFixedRecurringPayment=vi.fn().mockResolvedValue({status:'active',provider_correlation_id:'provider-read-1'})
    const reconcile=createUnknownCancellationReconciler({store,provider:()=>({getFixedRecurringPayment} as never),now:()=>new Date('2026-08-15T12:00:00Z')})
    const candidate={operationId:1,scheduleId:11,environment:'sandbox' as const,providerScheduleId:'schedule-11'}
    await reconcile(candidate)
    expect(getFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(recordCancellationObservation).toHaveBeenCalledWith(expect.objectContaining({operationId:1,scheduleId:11,providerStatus:'active',cancelled:false}))
  })
})
