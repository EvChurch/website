import { describe, expect, it, vi } from 'vitest'
import { createGivingCancellationService, GivingCancellationError, normalizeCancellationReason, type CancellationTarget, type GivingCancellationStore } from './cancellation'
import { BlinkPayClientError } from './blinkpay/client'

function setup(providerOverrides: Record<string, unknown> = {}) {
  let nonce: { actorId:number;scheduleId:number;reasonDigest:string;tokenDigest:string;expiresAt:Date } | undefined
  const target: CancellationTarget = { scheduleId:7,checkoutId:3,environment:'sandbox',providerScheduleId:'33333333-3333-4333-8333-333333333333',actorId:11,reason:'Donor request',operationId:9,keys:{requestId:'request-key-00000001',idempotencyKey:'idempotency-key-00000001'} }
  const store: GivingCancellationStore = {
    issueNonce: vi.fn(async (input) => { nonce = input }),
    begin: vi.fn(async (input) => {
      if (!nonce || input.actorId !== nonce.actorId || input.scheduleId !== nonce.scheduleId || input.reasonDigest !== nonce.reasonDigest || input.tokenDigest !== nonce.tokenDigest) throw new GivingCancellationError('confirmation-invalid')
      nonce = undefined
      return target
    }),
    finish: vi.fn(async () => undefined),
  }
  const provider = {
    cancelFixedRecurringPayment: vi.fn(async () => ({ outcome:'succeeded',value:undefined,metadata:{requestId:'request-key-00000001',idempotencyKey:'idempotency-key-00000001'} } as const)),
    getFixedRecurringPayment: vi.fn(),
    ...providerOverrides,
  }
  const service = createGivingCancellationService({ store,provider:()=>provider,now:()=>new Date('2026-08-15T00:00:00Z'),randomToken:()=> 'N'.repeat(43),randomId:()=> '11111111-1111-4111-8111-111111111111' })
  return { service,store,provider }
}

describe('giving schedule cancellation', () => {
  it('requires a bounded reason and a fresh actor/schedule/reason-bound nonce', async () => {
    expect(() => normalizeCancellationReason(' x ')).toThrow(GivingCancellationError)
    const { service,store } = setup()
    const prepared = await service.prepare({ actorId:11,scheduleId:7,reason:'  Donor   request ' })
    await expect(service.confirm({ actorId:12,scheduleId:7,reason:'Donor request',nonce:prepared.nonce })).rejects.toThrow(/confirmation-invalid/)
    expect(store.begin).toHaveBeenCalledWith(expect.objectContaining({ actorId:12,scheduleId:7,reason:'Donor request' }))
  })

  it('cancels once, records success and never touches consent', async () => {
    const { service,store,provider } = setup()
    const prepared = await service.prepare({ actorId:11,scheduleId:7,reason:'Donor request' })
    await expect(service.confirm({ actorId:11,scheduleId:7,reason:'Donor request',nonce:prepared.nonce })).resolves.toEqual({ status:'cancelled' })
    expect(provider.cancelFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(store.finish).toHaveBeenCalledWith(expect.objectContaining({ outcome:'cancelled',target:expect.objectContaining({ scheduleId:7 }) }))
  })

  it('reconciles an ambiguous DELETE with one GET and does not issue a second DELETE', async () => {
    const cancelFixedRecurringPayment = vi.fn(async () => ({ outcome:'unknown',reason:'request-ambiguous',metadata:{requestId:'request-key-00000001',idempotencyKey:'idempotency-key-00000001'} } as const))
    const getFixedRecurringPayment = vi.fn(async () => ({ status:'cancelled' }))
    const { service,store } = setup({ cancelFixedRecurringPayment,getFixedRecurringPayment })
    const prepared = await service.prepare({ actorId:11,scheduleId:7,reason:'Donor request' })
    await expect(service.confirm({ actorId:11,scheduleId:7,reason:'Donor request',nonce:prepared.nonce })).resolves.toEqual({ status:'cancelled' })
    expect(cancelFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(getFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(store.finish).toHaveBeenCalledWith(expect.objectContaining({ outcome:'cancelled',providerStatus:'cancelled' }))
  })

  it('keeps an unconfirmed ambiguity unknown even when the immediate GET still says active', async () => {
    const cancel = vi.fn(async () => ({ outcome:'unknown',reason:'request-ambiguous',metadata:{requestId:'r'.repeat(16),idempotencyKey:'i'.repeat(16)} } as const))
    const unknown = setup({ cancelFixedRecurringPayment:cancel,getFixedRecurringPayment:vi.fn(async()=>{ throw new Error('timeout') }) })
    let prepared = await unknown.service.prepare({ actorId:11,scheduleId:7,reason:'Donor request' })
    await expect(unknown.service.confirm({ actorId:11,scheduleId:7,reason:'Donor request',nonce:prepared.nonce })).resolves.toEqual({ status:'unknown' })
    expect(unknown.store.finish).toHaveBeenCalledWith(expect.objectContaining({ outcome:'unknown' }))
    const active = setup({ cancelFixedRecurringPayment:cancel,getFixedRecurringPayment:vi.fn(async()=>({status:'active'})) })
    prepared = await active.service.prepare({ actorId:11,scheduleId:7,reason:'Donor request' })
    await expect(active.service.confirm({ actorId:11,scheduleId:7,reason:'Donor request',nonce:prepared.nonce })).resolves.toEqual({ status:'unknown' })
    expect(active.store.finish).toHaveBeenCalledWith(expect.objectContaining({ outcome:'unknown',providerStatus:'active' }))
    expect(cancel).toHaveBeenCalledTimes(2)
  })

  it('returns to a recoverable state only for a definitive thrown 4xx rejection', async () => {
    const rejected=setup({cancelFixedRecurringPayment:vi.fn(async()=>{throw new BlinkPayClientError('request-rejected',409)})})
    const prepared=await rejected.service.prepare({actorId:11,scheduleId:7,reason:'Donor request'})
    await expect(rejected.service.confirm({actorId:11,scheduleId:7,reason:'Donor request',nonce:prepared.nonce})).resolves.toEqual({status:'not-cancelled'})
    expect(rejected.store.finish).toHaveBeenCalledWith(expect.objectContaining({outcome:'recoverable',errorCode:'provider-rejected'}))
  })
})
