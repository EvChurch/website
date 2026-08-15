import { describe, expect, it, vi } from 'vitest'

import { createGivingCheckoutService, GivingCheckoutError, type GivingCheckoutOperation, type GivingCheckoutRecord, type GivingCheckoutRepository } from './service'

const context = { contextKey: 'sandbox:e2e:run-1', environment: 'sandbox' as const, synthetic: true, e2eRunId: 7 }
const baseSubmission = { submissionKey: 'A'.repeat(43), amountMinor: 2500, fundId: 1, frequency: 'one-off' as const, firstPaymentDate: null, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', turnstileToken: 'turnstile' }

function repository(): GivingCheckoutRepository & { checkouts: GivingCheckoutRecord[]; operations: GivingCheckoutOperation[] } {
  const checkouts: GivingCheckoutRecord[] = []
  const operations: GivingCheckoutOperation[] = []
  const returns = new Map<string, number>()
  const statuses = new Map<string, number>()
  return {
    checkouts, operations,
    async createOrReuse(input) {
      const existing = checkouts.find((checkout) => checkout.submissionKeyDigest === input.submissionKeyDigest)
      if (existing) {
        if (existing.submissionDigest !== input.submissionDigest) throw new GivingCheckoutError('conflict')
        const operation = operations.find((item) => (item as GivingCheckoutOperation & { checkoutId?: number }).checkoutId === existing.id)
        if (existing.gatewayRedirectUri) {
          return { checkout: existing, reused: true, disposition: [...returns.values()].includes(existing.id) ? 'redirect' as const : 'recover' as const }
        }
        if (operation && ['submitted','succeeded','unknown'].includes(operation.status)) {
          existing.status = 'unknown'; existing.resultCode = 'unknown'
          return { checkout: existing, reused: true, disposition: 'recover' as const }
        }
        for (const [digest,id] of returns) if (id === existing.id) returns.delete(digest)
        returns.set(input.returnCapabilityDigest, existing.id)
        return { checkout: existing, reused: true, disposition: 'start' as const }
      }
      const checkout: GivingCheckoutRecord = { contextKey: input.contextKey, environment: input.environment, synthetic: input.synthetic, e2eRunId: input.e2eRunId, id: checkouts.length + 1, giverId: null, bankReference: null, fundId: 1, fundName: 'General', fundCode: 'GEN', fundAccountingKey: 'general', amountMinor: input.submission.amountMinor, frequency: input.submission.frequency, firstPaymentDate: input.submission.firstPaymentDate, correlationKey: input.correlationKey, submissionKeyDigest: input.submissionKeyDigest, submissionDigest: input.submissionDigest, gatewayRedirectUri: null, status: 'draft', resultCode: null }
      checkouts.push(checkout); returns.set(input.returnCapabilityDigest, checkout.id)
      return { checkout, reused: false, disposition: 'start' as const }
    },
    async get(id) { return checkouts.find((checkout) => checkout.id === id) ?? null },
    async rotateStatusCapability(id,digest) { statuses.clear(); statuses.set(digest,id) },
    async prepareOperation(checkout,action,digest,keys) {
      const existing = operations.find((operation) => operation.action === action && (operation as GivingCheckoutOperation & { checkoutId?: number }).checkoutId === checkout.id)
      if (existing) { if (existing.requestDigest !== digest) throw new Error('digest mismatch'); return existing }
      const operation: GivingCheckoutOperation = { id: operations.length + 1, action, status: 'prepared', providerId: null, requestId: keys.requestId, idempotencyKey: keys.idempotencyKey, requestDigest: digest }
      ;(operation as GivingCheckoutOperation & { checkoutId: number }).checkoutId = checkout.id
      operations.push(operation); return operation
    },
    async markSubmitted(id) { operations.find((operation) => operation.id === id)!.status = 'submitted' },
    async markUnknown(id) { operations.find((operation) => operation.id === id)!.status = 'unknown'; checkouts[0].status = 'unknown'; checkouts[0].resultCode = 'unknown' },
    async recordAcceptedUnknown(input) { const operation=operations.find((item)=>item.id===input.operationId)!;operation.status='unknown';operation.providerId=input.providerId;const checkout=checkouts.find((item)=>item.id===input.checkoutId)!;checkout.status='unknown';checkout.resultCode='unknown' },
    async markFailed(id) { operations.find((operation) => operation.id === id)!.status = 'failed' },
    async recordHostedSuccess(input) { const stored=operations.find((operation)=>operation.id===input.operation.id)!; stored.status = 'succeeded'; stored.providerId = input.providerId; const checkout=checkouts.find((item)=>item.id===input.checkout.id)!;checkout.gatewayRedirectUri = input.gatewayRedirectUri; checkout.status = 'authorising'; checkout.resultCode = 'processing' },
    async consumeReturn(digest,expectedProviderId,_now,statusDigest) { const id = returns.get(digest); if (!id) return null; const checkout=checkouts.find((item)=>item.id===id)!;const operation=operations.find((item)=>(item as GivingCheckoutOperation & {checkoutId?:number}).checkoutId===id);if(expectedProviderId&&operation?.providerId!==expectedProviderId)return null;returns.delete(digest); statuses.clear(); statuses.set(statusDigest,id); checkout.status = 'verifying'; return checkout },
    async findByStatusCapability(digest) { const id=statuses.get(digest); return id ? checkouts.find((checkout)=>checkout.id===id) ?? null : null },
    async findOperation(id,action) { return operations.find((operation)=>operation.action===action&&(operation as GivingCheckoutOperation & {checkoutId?:number}).checkoutId===id) ?? null },
    async completeOneOff(checkout) { checkout.status='completed'; checkout.resultCode='verified' },
    async recordConsentAuthorised() { return 11 },
    async bindScheduleProviderId(_checkout,operation,_consentId,providerId) { const stored=operations.find((item)=>item.id===operation.id)!; stored.status='succeeded'; stored.providerId=providerId },
    async completeSchedule(checkout) { checkout.status='completed'; checkout.resultCode='verified' },
    async setProcessing(id) { const checkout=checkouts.find((item)=>item.id===id)!; if(checkout.status!=='unknown'){checkout.status='verifying';checkout.resultCode='processing'} },
    async setFailed(id,code) { const checkout=checkouts.find((item)=>item.id===id)!; checkout.status='failed';checkout.resultCode=code },
  }
}

function service(repo = repository(), overrides: Record<string, unknown> = {}, resolveIdentity?: () => Promise<any>) {
  let uuid = 0
  const blinkPay = {
    createQuickPayment: vi.fn(async (_input, keys) => ({ outcome: 'succeeded' as const, value: { quick_payment_id: 'quick-1', redirect_uri: 'https://sandbox.debit.blinkpay.co.nz/gateway/quick' }, metadata: keys })),
    getQuickPayment: vi.fn(async () => ({ quick_payment_id: 'quick-1', consent: { consent_id: 'consent-1', status: 'Authorised', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, payments: [{ payment_id: 'payment-1', type: 'single', status: 'AcceptedSettlementCompleted', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:01Z', detail: {}, refunds: [] }] } })),
    createEnduringConsent: vi.fn(async (_input,keys) => ({ outcome: 'succeeded' as const, value: { consent_id: 'consent-1', redirect_uri: 'https://sandbox.debit.blinkpay.co.nz/gateway/consent' }, metadata: keys })),
    getEnduringConsent: vi.fn(async () => ({ consent_id: 'consent-1', status: 'Authorised', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:01Z', detail: {}, payments: [] })),
    createFixedRecurringPayment: vi.fn(async (_input,keys) => ({ outcome: 'succeeded' as const, value: { fixed_recurring_payment_id: 'schedule-1' }, metadata: keys })),
    getFixedRecurringPayment: vi.fn(async () => ({ fixed_recurring_payment_id: 'schedule-1', consent_id: 'consent-1', status: 'active', start_date: '2026-09-01', next_payment_date: '2026-09-01', amount: { total: '25.00', currency: 'NZD' as const }, pcr: { particulars: 'GEN' }, retry_strategy: 'same_day' as const, creation_timestamp: '2026-08-15T00:00:02Z' })),
    isPaymentSettled: (value: { status: string }) => value.status === 'AcceptedSettlementCompleted', isConsentAuthorised: (value: { status: string }) => value.status === 'Authorised', isFixedRecurringPaymentActive: (value: { status: string }) => value.status === 'active',
    ...overrides,
  }
  const checkout = createGivingCheckoutService({ repository: repo, blinkPay: blinkPay as any, digestSecret: 's'.repeat(32), now: () => new Date('2026-08-15T00:00:00Z'), randomBytes: () => Buffer.alloc(32, 1), uuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`, resolveIdentity: resolveIdentity ?? (async () => { repo.checkouts[0].giverId=9; repo.checkouts[0].bankReference='EV123'; return { giverId:9,personAliasId:123,bankReference:'EV123',firstName:'Ada',lastName:'Lovelace',email:'ada@example.com' } }) })
  return { checkout, blinkPay, repo }
}

describe('giving checkout orchestration', () => {
  it('reuses an identical submission, commits caller-owned keys before the call and verifies one-off settlement authoritatively', async () => {
    const { checkout, blinkPay, repo } = service()
    const first = await checkout.start({ ...context, submission: baseSubmission })
    const second = await checkout.start({ ...context, submission: baseSubmission })
    expect(second).toMatchObject({ reused: true, gatewayRedirectUri: first.gatewayRedirectUri })
    expect(blinkPay.createQuickPayment).toHaveBeenCalledTimes(1)
    expect(blinkPay.createQuickPayment.mock.calls[0][1]).toEqual({ requestId: repo.operations[0].requestId, idempotencyKey: repo.operations[0].idempotencyKey })
    const callback = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri
    const token = callback.split('/').at(-1)!
    const returned = await checkout.consumeReturn(token)
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'verified', retryAllowed: false, kind: 'one-off' })
  })

  it('records an ambiguous create as unknown and never issues a blind second create', async () => {
    const createQuickPayment = vi.fn(async (_input,keys) => ({ outcome: 'unknown' as const, reason: 'request-ambiguous' as const, metadata: keys }))
    const { checkout } = service(repository(), { createQuickPayment })
    const first = await checkout.start({ ...context, submission: baseSubmission })
    expect(first).toMatchObject({ outcome: 'unknown', retryAllowed: false, reused: false })
    const second = await checkout.start({ ...context, submission: baseSubmission })
    expect(second).toMatchObject({ outcome: 'unknown', retryAllowed: false, reused: true })
    await expect(checkout.status(first.statusToken)).resolves.toEqual({ state: 'unknown', retryAllowed: false, kind: 'one-off' })
    expect(createQuickPayment).toHaveBeenCalledTimes(1)
  })

  it.each([
    { frequency: 'one-off' as const, firstPaymentDate: null, providerId: 'quick-1' },
    { frequency: 'monthly' as const, firstPaymentDate: '2026-09-01', providerId: 'consent-1' },
  ])('persists an accepted hosted provider ID when local binding fails for $frequency', async ({ frequency, firstPaymentDate, providerId }) => {
    const repo = repository()
    vi.spyOn(repo, 'recordHostedSuccess').mockRejectedValue(new Error('database unavailable'))
    const acceptedUnknown = vi.spyOn(repo, 'recordAcceptedUnknown')
    const { checkout, blinkPay } = service(repo)
    const result = await checkout.start({ ...context, submission: { ...baseSubmission, frequency, firstPaymentDate } })
    expect(result).toMatchObject({ outcome: 'unknown', retryAllowed: false })
    expect(acceptedUnknown).toHaveBeenCalledWith(expect.objectContaining({ checkoutId: 1, operationId: 1, providerId }))
    expect(repo.operations[0]).toMatchObject({ status: 'unknown', providerId })
    await expect(checkout.start({ ...context, submission: { ...baseSubmission, frequency, firstPaymentDate } })).resolves.toMatchObject({ outcome:'unknown',retryAllowed:false,reused:true })
    expect(frequency==='one-off'?blinkPay.createQuickPayment:blinkPay.createEnduringConsent).toHaveBeenCalledTimes(1)
  })

  it('conflicts when the same submission key is reused with a changed canonical body', async () => {
    const { checkout } = service()
    await checkout.start({ ...context, submission: baseSubmission })
    await expect(checkout.start({ ...context, submission: { ...baseSubmission, amountMinor: 2600 } })).rejects.toMatchObject({ code: 'conflict' })
  })

  it('does not cross-reuse the same key and body between giving contexts', async () => {
    const repo = repository()
    const { checkout } = service(repo)
    await checkout.start({ ...context, submission: baseSubmission })
    await checkout.start({ contextKey: 'sandbox:e2e:run-2', environment: 'sandbox', synthetic: true, e2eRunId: 8, submission: baseSubmission })
    expect(repo.checkouts).toHaveLength(2)
  })

  it('rotates the return capability when retrying a crash before any provider operation', async () => {
    const repo = repository()
    let attempts = 0
    const resolved = { giverId:9,personAliasId:123,bankReference:'EV123',firstName:'Ada',lastName:'Lovelace',email:'ada@example.com' }
    const { checkout, blinkPay } = service(repo, {}, async () => {
      attempts += 1
      if (attempts === 1) throw new Error('crash before provider operation')
      repo.checkouts[0].giverId = 9
      repo.checkouts[0].bankReference = 'EV123'
      return resolved
    })
    await expect(checkout.start({ ...context, submission: baseSubmission })).rejects.toThrow()
    await checkout.start({ ...context, submission: baseSubmission })
    const returnToken = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    await expect(checkout.consumeReturn(returnToken)).resolves.toBeDefined()
  })

  it('keeps the original live return capability when reusing a hosted Gateway URL', async () => {
    const { checkout, blinkPay } = service()
    const first = await checkout.start({ ...context, submission: baseSubmission })
    const originalToken = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    const reused = await checkout.start({ ...context, submission: baseSubmission })
    expect(reused).toMatchObject({ outcome: 'redirect', reused: true, gatewayRedirectUri: first.outcome === 'redirect' ? first.gatewayRedirectUri : undefined })
    await expect(checkout.consumeReturn(originalToken)).resolves.toBeDefined()
  })

  it('returns explicit no-retry recovery when a reused Gateway capability was consumed', async () => {
    const { checkout, blinkPay } = service()
    await checkout.start({ ...context, submission: baseSubmission })
    const originalToken = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    await checkout.consumeReturn(originalToken)
    await expect(checkout.start({ ...context, submission: baseSubmission })).resolves.toMatchObject({ outcome: 'unknown', retryAllowed: false, reused: true })
    expect(blinkPay.createQuickPayment).toHaveBeenCalledTimes(1)
  })

  it('exchanges a valid return capability even when authoritative retrieval is temporarily unavailable', async () => {
    const { checkout, blinkPay } = service(repository(), { getQuickPayment: vi.fn(async () => { throw new Error('provider unavailable') }) })
    await checkout.start({ ...context, submission: baseSubmission })
    const token = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    const returned = await checkout.consumeReturn(token)
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'processing', retryAllowed: false, kind: 'one-off' })
  })

  it('returns the persisted status capability when recovery setProcessing also fails', async () => {
    const repo = repository()
    vi.spyOn(repo, 'setProcessing').mockRejectedValue(new Error('database unavailable'))
    const { checkout, blinkPay } = service(repo, { getQuickPayment: vi.fn(async () => { throw new Error('provider unavailable') }) })
    await checkout.start({ ...context, submission: baseSubmission })
    const token = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    await expect(checkout.consumeReturn(token)).resolves.toMatchObject({ statusToken: expect.any(String), checkoutId: 1 })
  })

  it('reconciles a transient return failure on status poll and completes one gift exactly once', async () => {
    const repo = repository()
    const completeOneOff = vi.spyOn(repo, 'completeOneOff')
    const settled = { quick_payment_id: 'quick-1', consent: { consent_id: 'consent-1', status: 'Authorised', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, payments: [{ payment_id: 'payment-1', type: 'single', status: 'AcceptedSettlementCompleted', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:01Z', detail: {}, refunds: [] }] } }
    const getQuickPayment = vi.fn().mockRejectedValueOnce(new Error('temporarily unavailable')).mockResolvedValue(settled)
    const { checkout, blinkPay } = service(repo, { getQuickPayment })
    await checkout.start({ ...context, submission: baseSubmission })
    const token = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    const returned = await checkout.consumeReturn(token)
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'verified', retryAllowed: false, kind: 'one-off' })
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'verified', retryAllowed: false, kind: 'one-off' })
    expect(completeOneOff).toHaveBeenCalledTimes(1)
  })

  it('rejects a mismatched callback alias without consuming the return capability', async () => {
    const { checkout, blinkPay } = service()
    await checkout.start({ ...context, submission: baseSubmission })
    const token = blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    await expect(checkout.consumeReturn(token, 'quick-other')).rejects.toMatchObject({ code: 'unavailable' })
    await expect(checkout.consumeReturn(token, 'quick-1')).resolves.toBeDefined()
  })

  it('creates exactly one schedule after authoritative consent authorisation and verifies it active', async () => {
    const { checkout, blinkPay } = service()
    await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    const callback = blinkPay.createEnduringConsent.mock.calls[0][0].flow.detail.redirect_uri
    await checkout.consumeReturn(callback.split('/').at(-1)!)
    await checkout.verify(1)
    expect(blinkPay.createFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(blinkPay.getEnduringConsent).toHaveBeenCalled()
    expect(blinkPay.getFixedRecurringPayment).toHaveBeenCalled()
  })

  it('marks a definitive schedule rejection failed instead of leaving it submitted', async () => {
    const createFixedRecurringPayment = vi.fn(async () => { throw { code: 'request-rejected' } })
    const { checkout, blinkPay } = service(repository(), { createFixedRecurringPayment })
    await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    const token = blinkPay.createEnduringConsent.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    const returned = await checkout.consumeReturn(token)
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'rejected', retryAllowed: true, kind: 'recurring' })
  })

  it('marks an ambiguous schedule exception unknown and does not retry it', async () => {
    const createFixedRecurringPayment = vi.fn(async () => { throw new TypeError('network unavailable') })
    const { checkout, blinkPay } = service(repository(), { createFixedRecurringPayment })
    await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    const token = blinkPay.createEnduringConsent.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    const returned = await checkout.consumeReturn(token)
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'unknown', retryAllowed: false, kind: 'recurring' })
    await checkout.verify(1)
    expect(createFixedRecurringPayment).toHaveBeenCalledTimes(1)
  })

  it('persists an accepted schedule ID after binding failure and reconciles without another create', async () => {
    const repo = repository()
    vi.spyOn(repo, 'bindScheduleProviderId').mockRejectedValue(new Error('database unavailable'))
    const acceptedUnknown = vi.spyOn(repo, 'recordAcceptedUnknown')
    const { checkout, blinkPay } = service(repo)
    await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    const token = blinkPay.createEnduringConsent.mock.calls[0][0].flow.detail.redirect_uri.split('/').at(-1)!
    const returned = await checkout.consumeReturn(token)
    expect(acceptedUnknown).toHaveBeenCalledWith(expect.objectContaining({ action: 'blinkpay.create-schedule', providerId: 'schedule-1' }))
    await checkout.verify(1)
    expect(blinkPay.createFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(blinkPay.getFixedRecurringPayment).toHaveBeenCalledWith('schedule-1')
    await expect(checkout.status(returned.statusToken)).resolves.toMatchObject({ retryAllowed: false })
  })
})
