import { describe, expect, it, vi } from 'vitest'

import { createGivingCheckoutService, GivingCheckoutError, prepareGivingBankTransfer, type GivingCheckoutBlinkPayClient, type GivingCheckoutOperation, type GivingCheckoutRecord, type GivingCheckoutRepository, type GivingCheckoutStartResult } from './service'
import type { ResolvedGivingIdentity } from './rock-identity'

const context = { contextKey: 'sandbox', environment: 'sandbox' as const, synthetic: true }
const baseSubmission = { submissionKey: 'A'.repeat(43), amountMinor: 2500, fundId: 1, frequency: 'one-off' as const, firstPaymentDate: null, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', turnstileToken: 'turnstile' }

interface TestSchedule { checkoutId: number; consentId: number; providerScheduleId: string; status: 'pending' | 'active' }

function repository(): GivingCheckoutRepository & { checkouts: GivingCheckoutRecord[]; operations: GivingCheckoutOperation[]; schedules: TestSchedule[] } {
  const checkouts: GivingCheckoutRecord[] = []
  const operations: GivingCheckoutOperation[] = []
  const schedules: TestSchedule[] = []
  const returns = new Map<string, number>()
  const statuses = new Map<string, number>()
  return {
    checkouts, operations, schedules,
    async createOrReuse(input) {
      const existing = checkouts.find((checkout) => checkout.submissionKeyDigest === input.submissionKeyDigest)
      if (existing) {
        if (existing.submissionDigest !== input.submissionDigest) throw new GivingCheckoutError('conflict')
        const operation = operations.find((item) => (item as GivingCheckoutOperation & { checkoutId?: number }).checkoutId === existing.id)
        if (existing.gatewayRedirectUri) {
          const returnCapabilityLive = [...returns.values()].includes(existing.id)
          if (returnCapabilityLive) {
            for (const [digest,id] of returns) if (id === existing.id) returns.delete(digest)
            returns.set(input.returnCapabilityDigest, existing.id)
          }
          return { checkout: existing, reused: true, disposition: returnCapabilityLive ? 'redirect' as const : 'recover' as const }
        }
        if (operation && ['submitted','succeeded','unknown'].includes(operation.status)) {
          existing.status = 'unknown'; existing.resultCode = 'unknown'
          return { checkout: existing, reused: true, disposition: 'recover' as const }
        }
        for (const [digest,id] of returns) if (id === existing.id) returns.delete(digest)
        returns.set(input.returnCapabilityDigest, existing.id)
        return { checkout: existing, reused: true, disposition: 'start' as const }
      }
      const checkout: GivingCheckoutRecord = { contextKey: input.contextKey, environment: input.environment, synthetic: input.synthetic, id: checkouts.length + 1, giverId: null, bankReference: null, bankCode: 'ALOVELACE', fundId: 1, fundName: 'General', fundCode: 'GEN', fundAccountingKey: 'general', amountMinor: input.submission.amountMinor, frequency: input.submission.frequency, firstPaymentDate: input.submission.firstPaymentDate, correlationKey: input.correlationKey, submissionKeyDigest: input.submissionKeyDigest, submissionDigest: input.submissionDigest, gatewayRedirectUri: null, status: 'draft', resultCode: null }
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
    async acknowledgeBankSetup() { return true },
    async recordHostedSuccess(input) { const stored=operations.find((operation)=>operation.id===input.operation.id)!; stored.status = 'succeeded'; stored.providerId = input.providerId; const checkout=checkouts.find((item)=>item.id===input.checkout.id)!;checkout.gatewayRedirectUri = input.gatewayRedirectUri; checkout.status = 'authorising'; checkout.resultCode = 'processing' },
    async consumeReturn(digest,expectedProviderId,_now,statusDigest) { const id = returns.get(digest); if (!id) return null; const checkout=checkouts.find((item)=>item.id===id)!;const operation=operations.find((item)=>(item as GivingCheckoutOperation & {checkoutId?:number}).checkoutId===id);if(expectedProviderId&&operation?.providerId!==expectedProviderId)return null;returns.delete(digest); statuses.clear(); statuses.set(statusDigest,id); checkout.status = 'verifying'; return checkout },
    async findByStatusCapability(digest) { const id=statuses.get(digest); return id ? checkouts.find((checkout)=>checkout.id===id) ?? null : null },
    async findOperation(id,action) { return operations.find((operation)=>operation.action===action&&(operation as GivingCheckoutOperation & {checkoutId?:number}).checkoutId===id) ?? null },
    async completeOneOff(checkout) { checkout.status='completed'; checkout.resultCode='verified' },
    async recordConsentAuthorised() { return 11 },
    async bindScheduleProviderId(checkout,operation,consentId,providerId) { schedules.push({checkoutId:checkout.id,consentId,providerScheduleId:providerId,status:'pending'}); const stored=operations.find((item)=>item.id===operation.id)!; stored.status='succeeded'; stored.providerId=providerId },
    async completeSchedule(checkout,operation,consentId,provider) { let schedule=schedules.find((item)=>item.consentId===consentId);if(!schedule){schedule={checkoutId:checkout.id,consentId,providerScheduleId:provider.fixed_recurring_payment_id,status:'active'};schedules.push(schedule)}if(schedule.checkoutId!==checkout.id||schedule.providerScheduleId!==provider.fixed_recurring_payment_id||operation.providerId!==provider.fixed_recurring_payment_id)throw new GivingCheckoutError('conflict');schedule.status='active';operations.find((item)=>item.id===operation.id)!.status='succeeded';checkout.status='completed';checkout.resultCode='verified' },
    async setProcessing(id) { const checkout=checkouts.find((item)=>item.id===id)!; if(checkout.status!=='unknown'){checkout.status='verifying';checkout.resultCode='processing'} },
    async setFailed(id,code) { const checkout=checkouts.find((item)=>item.id===id)!; checkout.status='failed';checkout.resultCode=code },
  }
}

function service(repo = repository(), overrides: Partial<GivingCheckoutBlinkPayClient> = {}, resolveIdentity?: () => Promise<ResolvedGivingIdentity>) {
  let uuid = 0
  let random = 0
  const blinkPay = {
    createQuickPayment: vi.fn(async (_input, keys) => ({ outcome: 'succeeded' as const, value: { quick_payment_id: 'quick-1', redirect_uri: 'https://sandbox.debit.blinkpay.co.nz/gateway/quick' }, metadata: keys })),
    getQuickPayment: vi.fn(async () => ({ quick_payment_id: 'quick-1', consent: { consent_id: 'consent-1', status: 'Authorised', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, payments: [{ payment_id: 'payment-1', type: 'single', status: 'AcceptedSettlementCompleted', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:01Z', detail: {}, refunds: [] }] } })),
    createEnduringConsent: vi.fn(async (_input,keys) => ({ outcome: 'succeeded' as const, value: { consent_id: 'consent-1', redirect_uri: 'https://sandbox.debit.blinkpay.co.nz/gateway/consent' }, metadata: keys })),
    getEnduringConsent: vi.fn(async () => ({ consent_id: 'consent-1', status: 'Authorised', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:01Z', detail: {}, payments: [] })),
    createFixedRecurringPayment: vi.fn(async (_input,keys) => ({ outcome: 'succeeded' as const, value: { fixed_recurring_payment_id: 'schedule-1' }, metadata: keys })),
    getFixedRecurringPayment: vi.fn(async () => ({ fixed_recurring_payment_id: 'schedule-1', consent_id: 'consent-1', status: 'active', start_date: '2026-09-01', next_payment_date: '2026-09-01', amount: { total: '25.00', currency: 'NZD' as const }, pcr: { particulars: 'GEN' }, retry_strategy: 'same_day' as const, creation_timestamp: '2026-08-15T00:00:02Z' })),
    isPaymentSettled: (value: { status: string }) => value.status === 'AcceptedSettlementCompleted', isConsentAuthorised: (value: { status: string }) => value.status === 'Authorised', isFixedRecurringPaymentActive: (value: { status: string }) => value.status === 'active',
  } satisfies GivingCheckoutBlinkPayClient
  const client: GivingCheckoutBlinkPayClient = { ...blinkPay, ...overrides }
  const checkout = createGivingCheckoutService({ repository: repo, blinkPay: client, digestSecret: 's'.repeat(32), now: () => new Date('2026-08-15T00:00:00Z'), randomBytes: () => Buffer.alloc(32, ++random), uuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`, resolveIdentity: resolveIdentity ?? (async () => { repo.checkouts[0].giverId=9; repo.checkouts[0].bankReference='EV123'; return { giverId:9,personAliasId:123,bankReference:'EV123',firstName:'Ada',lastName:'Lovelace',email:'ada@example.com' } }) })
  return { checkout, blinkPay, repo }
}

function returnToken(result: GivingCheckoutStartResult) {
  if (result.outcome !== 'redirect' || !result.returnToken) throw new Error('Expected a new hosted redirect')
  return result.returnToken
}

describe('giving checkout orchestration', () => {
  it('prepares direct-bank references through the same Rock identity resolution without calling BlinkPay', async () => {
    const repo = repository()
    const resolveIdentity = vi.fn(async () => {
      repo.checkouts[0].giverId = 9
      repo.checkouts[0].bankReference = 'EV123'
      return { giverId:9,personAliasId:123,bankReference:'EV123',firstName:'Ada',lastName:'Lovelace',email:'ada@example.com' }
    })
    const dependencies = {
      repository: repo,
      digestSecret: 's'.repeat(32),
      now: () => new Date('2026-08-15T00:00:00Z'),
      randomBytes: () => Buffer.alloc(32, 1),
      uuid: () => '00000000-0000-4000-8000-000000000001',
      resolveIdentity,
    }
    const first = await prepareGivingBankTransfer({ ...context, submission: baseSubmission }, dependencies)
    const second = await prepareGivingBankTransfer({ ...context, submission: baseSubmission }, dependencies)
    expect(first).toEqual({
      accountName: 'Auckland Evangelical Church Trust',
      accountNumber: '01-1845-0008260-05',
      particulars: 'GEN',
      code: 'ALOVELACE',
      reference: 'EV123',
      acknowledgementToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
    })
    expect(second).toMatchObject({ ...first, acknowledgementToken: expect.any(String) })
    expect(resolveIdentity).toHaveBeenCalledTimes(1)
    expect(repo.operations).toHaveLength(0)
  })

  it('recovers an interrupted direct-bank identity binding with the same submission key', async () => {
    const repo = repository()
    const interrupted: GivingCheckoutRecord = {
      id: 16,
      contextKey: 'production',
      environment: 'production',
      synthetic: false,
      giverId: null,
      bankReference: null,
      bankCode: 'ALOVELACE',
      fundId: 1,
      fundName: 'General',
      fundCode: 'GEN',
      fundAccountingKey: 'general',
      amountMinor: baseSubmission.amountMinor,
      frequency: baseSubmission.frequency,
      firstPaymentDate: baseSubmission.firstPaymentDate,
      correlationKey: 'interrupted-checkout',
      submissionKeyDigest: 'submission-key',
      submissionDigest: 'submission',
      gatewayRedirectUri: null,
      status: 'unknown',
      resultCode: 'unknown',
    }
    repo.createOrReuse = vi.fn(async () => ({ checkout: interrupted, reused: true, disposition: 'start' as const }))
    const resolveIdentity = vi.fn(async () => ({
      giverId: 1,
      personAliasId: 8604,
      bankReference: 'EV8604',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    }))

    await expect(prepareGivingBankTransfer({
      contextKey: 'production',
      environment: 'production',
      synthetic: false,
      submission: baseSubmission,
    }, {
      repository: repo,
      digestSecret: 's'.repeat(32),
      randomBytes: () => Buffer.alloc(32, 1),
      uuid: () => '00000000-0000-4000-8000-000000000001',
      resolveIdentity,
    })).resolves.toMatchObject({ reference: 'EV8604' })
    expect(resolveIdentity).toHaveBeenCalledOnce()
  })

  it('does not turn an ambiguous BlinkPay checkout into direct-bank instructions', async () => {
    const repo = repository()
    const blinkPayCheckout: GivingCheckoutRecord = {
      id: 17,
      contextKey: 'production',
      environment: 'production',
      synthetic: false,
      giverId: 1,
      bankReference: 'EV8604',
      bankCode: 'ALOVELACE',
      fundId: 1,
      fundName: 'General',
      fundCode: 'GEN',
      fundAccountingKey: 'general',
      amountMinor: baseSubmission.amountMinor,
      frequency: baseSubmission.frequency,
      firstPaymentDate: baseSubmission.firstPaymentDate,
      correlationKey: 'blinkpay-checkout',
      submissionKeyDigest: 'submission-key',
      submissionDigest: 'submission',
      gatewayRedirectUri: null,
      status: 'unknown',
      resultCode: 'unknown',
    }
    repo.createOrReuse = vi.fn(async () => ({
      checkout: blinkPayCheckout,
      reused: true,
      disposition: 'recover' as const,
    }))

    await expect(prepareGivingBankTransfer({
      contextKey: 'production',
      environment: 'production',
      synthetic: false,
      submission: baseSubmission,
    }, {
      repository: repo,
      digestSecret: 's'.repeat(32),
      randomBytes: () => Buffer.alloc(32, 1),
      uuid: () => '00000000-0000-4000-8000-000000000001',
      resolveIdentity: vi.fn(),
    })).rejects.toMatchObject({ code: 'conflict' })
  })

  it('reuses an identical submission, commits caller-owned keys before the call and verifies one-off settlement authoritatively', async () => {
    const { checkout, blinkPay, repo } = service()
    const first = await checkout.start({ ...context, submission: baseSubmission })
    const second = await checkout.start({ ...context, submission: baseSubmission })
    expect(second).toMatchObject({ reused: true, gatewayRedirectUri: first.gatewayRedirectUri })
    expect(blinkPay.createQuickPayment).toHaveBeenCalledTimes(1)
    expect(blinkPay.createQuickPayment.mock.calls[0][0].pcr).toEqual({ particulars: 'GEN', code: 'ALOVELACE', reference: 'EV123' })
    expect(blinkPay.createQuickPayment.mock.calls[0][1]).toEqual({ requestId: repo.operations[0].requestId, idempotencyKey: repo.operations[0].idempotencyKey })
    expect(blinkPay.createQuickPayment.mock.calls[0][1]).toEqual({
      requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu),
      idempotencyKey: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu),
    })
    expect(blinkPay.createQuickPayment.mock.calls[0][0].flow.detail.redirect_uri).toBe('https://www.ev.church/give/return')
    const returned = await checkout.consumeReturn(returnToken(second))
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'verified', retryAllowed: false, kind: 'one-off' })
  })

  it('records an ambiguous create as unknown and never issues a blind second create', async () => {
    const createQuickPayment = vi.fn(async (_input,keys) => ({ outcome: 'unknown' as const, reason: 'request-ambiguous' as const, metadata: keys }))
    const { checkout } = service(repository(), { createQuickPayment })
    const first = await checkout.start({ ...context, submission: baseSubmission })
    expect(first).toMatchObject({ outcome: 'unknown', retryAllowed: false, reused: false })
    const second = await checkout.start({ ...context, submission: baseSubmission })
    expect(second).toMatchObject({ outcome: 'unknown', retryAllowed: false, reused: true })
    await expect(checkout.status(second.statusToken)).resolves.toEqual({ state: 'unknown', retryAllowed: false, kind: 'one-off' })
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

  it('returns a no-retry unknown outcome when both provider-acceptance writes fail', async () => {
    const repo = repository()
    vi.spyOn(repo, 'recordHostedSuccess').mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(repo, 'recordAcceptedUnknown').mockRejectedValue(new Error('database still unavailable'))
    const { checkout, blinkPay } = service(repo)

    await expect(checkout.start({ ...context, submission: baseSubmission })).resolves.toMatchObject({ outcome: 'unknown', retryAllowed: false })
    await expect(checkout.start({ ...context, submission: baseSubmission })).resolves.toMatchObject({ outcome: 'unknown', retryAllowed: false, reused: true })
    expect(blinkPay.createQuickPayment).toHaveBeenCalledTimes(1)
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
    await checkout.start({ contextKey: 'production', environment: 'production', synthetic: false, submission: baseSubmission })
    expect(repo.checkouts).toHaveLength(2)
  })

  it('rotates the return capability when retrying a crash before any provider operation', async () => {
    const repo = repository()
    let attempts = 0
    const resolved = { giverId:9,personAliasId:123,bankReference:'EV123',firstName:'Ada',lastName:'Lovelace',email:'ada@example.com' }
    const { checkout } = service(repo, {}, async () => {
      attempts += 1
      if (attempts === 1) throw new Error('crash before provider operation')
      repo.checkouts[0].giverId = 9
      repo.checkouts[0].bankReference = 'EV123'
      return resolved
    })
    await expect(checkout.start({ ...context, submission: baseSubmission })).rejects.toThrow()
    const result = await checkout.start({ ...context, submission: baseSubmission })
    await expect(checkout.consumeReturn(returnToken(result))).resolves.toBeDefined()
  })

  it('rotates the live return capability when reusing a hosted Gateway URL', async () => {
    const { checkout } = service()
    const first = await checkout.start({ ...context, submission: baseSubmission })
    const originalToken = returnToken(first)
    const reused = await checkout.start({ ...context, submission: baseSubmission })
    expect(reused).toMatchObject({ outcome: 'redirect', reused: true, gatewayRedirectUri: first.outcome === 'redirect' ? first.gatewayRedirectUri : undefined })
    const reusedToken = returnToken(reused)
    expect(reusedToken).not.toBe(originalToken)
    await expect(checkout.consumeReturn(originalToken)).rejects.toMatchObject({ code: 'unavailable' })
    await expect(checkout.consumeReturn(reusedToken)).resolves.toBeDefined()
  })

  it('returns explicit no-retry recovery when a reused Gateway capability was consumed', async () => {
    const { checkout, blinkPay } = service()
    const started = await checkout.start({ ...context, submission: baseSubmission })
    const originalToken = returnToken(started)
    await checkout.consumeReturn(originalToken)
    await expect(checkout.start({ ...context, submission: baseSubmission })).resolves.toMatchObject({ outcome: 'unknown', retryAllowed: false, reused: true })
    expect(blinkPay.createQuickPayment).toHaveBeenCalledTimes(1)
  })

  it('exchanges a valid return capability even when authoritative retrieval is temporarily unavailable', async () => {
    const { checkout } = service(repository(), { getQuickPayment: vi.fn(async () => { throw new Error('provider unavailable') }) })
    const started = await checkout.start({ ...context, submission: baseSubmission })
    const returned = await checkout.consumeReturn(returnToken(started))
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'processing', retryAllowed: false, kind: 'one-off' })
  })

  it('returns the persisted status capability when recovery setProcessing also fails', async () => {
    const repo = repository()
    vi.spyOn(repo, 'setProcessing').mockRejectedValue(new Error('database unavailable'))
    const { checkout } = service(repo, { getQuickPayment: vi.fn(async () => { throw new Error('provider unavailable') }) })
    const started = await checkout.start({ ...context, submission: baseSubmission })
    await expect(checkout.consumeReturn(returnToken(started))).resolves.toMatchObject({ statusToken: expect.any(String), checkoutId: 1 })
  })

  it('reconciles a transient return failure on status poll and completes one gift exactly once', async () => {
    const repo = repository()
    const completeOneOff = vi.spyOn(repo, 'completeOneOff')
    const settled = { quick_payment_id: 'quick-1', consent: { consent_id: 'consent-1', status: 'Authorised', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, payments: [{ payment_id: 'payment-1', type: 'single', status: 'AcceptedSettlementCompleted', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:01Z', detail: {}, refunds: [] }] } }
    const getQuickPayment = vi.fn().mockRejectedValueOnce(new Error('temporarily unavailable')).mockResolvedValue(settled)
    const { checkout } = service(repo, { getQuickPayment })
    const started = await checkout.start({ ...context, submission: baseSubmission })
    const returned = await checkout.consumeReturn(returnToken(started))
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'verified', retryAllowed: false, kind: 'one-off' })
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'verified', retryAllowed: false, kind: 'one-off' })
    expect(completeOneOff).toHaveBeenCalledTimes(1)
  })

  it('rejects a mismatched callback alias without consuming the return capability', async () => {
    const { checkout } = service()
    const started = await checkout.start({ ...context, submission: baseSubmission })
    const token = returnToken(started)
    await expect(checkout.consumeReturn(token, 'quick-other')).rejects.toMatchObject({ code: 'unavailable' })
    await expect(checkout.consumeReturn(token, 'quick-1')).resolves.toBeDefined()
  })

  it('creates exactly one schedule after authoritative consent authorisation and verifies it active', async () => {
    const { checkout, blinkPay } = service()
    const started = await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    expect(blinkPay.createEnduringConsent.mock.calls[0][0].flow.detail.redirect_uri).toBe('https://www.ev.church/give/return')
    await checkout.consumeReturn(returnToken(started))
    await checkout.verify(1)
    expect(blinkPay.createFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(blinkPay.createFixedRecurringPayment.mock.calls[0][0].pcr).toEqual({ particulars: 'GEN', code: 'ALOVELACE', reference: 'EV123' })
    expect(blinkPay.getEnduringConsent).toHaveBeenCalled()
    expect(blinkPay.getFixedRecurringPayment).toHaveBeenCalled()
  })

  it('marks a definitive schedule rejection failed instead of leaving it submitted', async () => {
    const createFixedRecurringPayment = vi.fn(async () => { throw { code: 'request-rejected' } })
    const { checkout } = service(repository(), { createFixedRecurringPayment })
    const started = await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    const returned = await checkout.consumeReturn(returnToken(started))
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'rejected', retryAllowed: true, kind: 'recurring' })
  })

  it('marks an ambiguous schedule exception unknown and does not retry it', async () => {
    const createFixedRecurringPayment = vi.fn(async () => { throw new TypeError('network unavailable') })
    const { checkout } = service(repository(), { createFixedRecurringPayment })
    const started = await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    const returned = await checkout.consumeReturn(returnToken(started))
    expect(await checkout.status(returned.statusToken)).toEqual({ state: 'unknown', retryAllowed: false, kind: 'recurring' })
    await checkout.verify(1)
    expect(createFixedRecurringPayment).toHaveBeenCalledTimes(1)
  })

  it('persists an accepted schedule ID after binding failure and reconciles without another create', async () => {
    const repo = repository()
    vi.spyOn(repo, 'bindScheduleProviderId').mockRejectedValue(new Error('database unavailable'))
    const acceptedUnknown = vi.spyOn(repo, 'recordAcceptedUnknown')
    const { checkout, blinkPay } = service(repo)
    const started = await checkout.start({ ...context, submission: { ...baseSubmission, frequency: 'monthly', firstPaymentDate: '2026-09-01' } })
    const returned = await checkout.consumeReturn(returnToken(started))
    expect(acceptedUnknown).toHaveBeenCalledWith(expect.objectContaining({ action: 'blinkpay.create-schedule', providerId: 'schedule-1' }))
    await checkout.verify(1)
    expect(blinkPay.createFixedRecurringPayment).toHaveBeenCalledTimes(1)
    expect(blinkPay.getFixedRecurringPayment).toHaveBeenCalledWith('schedule-1')
    expect(repo.schedules).toEqual([{ checkoutId: 1, consentId: 11, providerScheduleId: 'schedule-1', status: 'active' }])
    await expect(checkout.status(returned.statusToken)).resolves.toMatchObject({ state: 'verified', retryAllowed: false })
  })
})
