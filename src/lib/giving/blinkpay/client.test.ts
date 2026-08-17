import { BlinkInvalidValueException, BlinkServiceException } from 'blink-debit-api-client-node'
import { describe, expect, it, vi } from 'vitest'

import { createBlinkPayClient, type BlinkPaySdkClient } from './client'
import { BlinkPayConfigurationError, loadBlinkPayConfig } from './config'

const sandboxEnv = {
  BLINKPAY_SANDBOX_CLIENT_ID: 'sandbox-id', BLINKPAY_SANDBOX_CLIENT_SECRET: 'sandbox-secret',
  BLINKPAY_PRODUCTION_CLIENT_ID: 'production-id', BLINKPAY_PRODUCTION_CLIENT_SECRET: 'production-secret',
}
const amount = { total: '12.34', currency: 'NZD' as const }
const pcr = { particulars: 'EV123', code: 'GENERAL', reference: 'DONATION' }
const operationKeys = {
  requestId: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
}
const token = { access_token: 'access-token', token_type: 'Bearer', expires_in: 3600, scope: 'view:payment' }

function json(value: unknown, status = 200, correlation = 'provider-correlation') {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-correlation-id': correlation } })
}

function sdk(overrides: Partial<BlinkPaySdkClient> = {}) {
  return {
    createQuickPaymentAsync: vi.fn(), getQuickPaymentAsync: vi.fn(),
    createEnduringConsentAsync: vi.fn(), getEnduringConsentAsync: vi.fn(), getPaymentAsync: vi.fn(),
    ...overrides,
  } as unknown as BlinkPaySdkClient
}

function directClient(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return createBlinkPayClient({
    config: loadBlinkPayConfig('sandbox', sandboxEnv), sdkClient: sdk(), fetchImpl,
    now: () => new Date('2026-08-15T00:00:00Z'), sleep: vi.fn(async () => undefined),
    uuid: vi.fn().mockReturnValue('33333333-3333-4333-8333-333333333333'), ...overrides,
  })
}

describe('BlinkPay configuration', () => {
  it('hard-codes environment origins and rejects URL overrides', () => {
    const sandbox = loadBlinkPayConfig('sandbox', sandboxEnv)
    expect(sandbox.oauthTokenUrl).toBe('https://sandbox.debit.blinkpay.co.nz/oauth2/token')
    expect(sandbox.apiBaseUrl).toBe('https://sandbox.debit.blinkpay.co.nz/payments/v1/')
    expect(sandbox.gatewayOrigins).toEqual(['https://sandbox.secure.blinkpay.co.nz'])
    expect(() => loadBlinkPayConfig('sandbox', { ...sandboxEnv, BLINKPAY_SANDBOX_API_URL: 'https://evil.test' })).toThrow(BlinkPayConfigurationError)
  })
})

describe('BlinkPay official SDK adapter', () => {
  it('creates an enduring consent with caller-owned operation IDs', async () => {
    const createEnduringConsentAsync = vi.fn().mockResolvedValue({
      data: { consentId: '44444444-4444-4444-8444-444444444444', redirectUri: 'https://sandbox.secure.blinkpay.co.nz/gateway/consent' },
      headers: { 'x-correlation-id': 'sdk-correlation' },
    })
    const api = createBlinkPayClient({
      config: loadBlinkPayConfig('sandbox', sandboxEnv), sdkClient: sdk({ createEnduringConsentAsync }),
      now: () => new Date('2026-08-15T00:00:00Z'),
    })
    await expect(api.createEnduringConsent({
      type: 'enduring', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } },
      from_timestamp: '2026-08-15T00:00:00Z', period: 'weekly',
      maximum_amount_period: amount, maximum_amount_payment: amount,
    }, operationKeys)).resolves.toMatchObject({
      outcome: 'succeeded', value: { consent_id: '44444444-4444-4444-8444-444444444444' },
      metadata: { ...operationKeys, correlationId: 'sdk-correlation' },
    })
    expect(createEnduringConsentAsync).toHaveBeenCalledWith(expect.objectContaining({
      type: 'enduring', flow: { detail: { type: 'gateway', redirectUri: 'https://www.ev.church/give/return' } },
      fromTimestamp: new Date('2026-08-15T00:00:00Z'), period: 'weekly',
    }), { requestId: operationKeys.requestId, xCorrelationId: operationKeys.requestId, idempotencyKey: operationKeys.idempotencyKey })
  })

  it('maps SDK payment details and provider correlation to the local contract', async () => {
    const getPaymentAsync = vi.fn().mockResolvedValue({
      data: {
        paymentId: '55555555-5555-4555-8555-555555555555', type: 'enduring', status: 'AcceptedSettlementCompleted',
        creationTimestamp: new Date('2026-08-15T00:00:00Z'), statusUpdatedTimestamp: new Date('2026-08-15T00:01:00Z'),
        detail: { consentId: '44444444-4444-4444-8444-444444444444' }, refunds: [],
      },
      headers: { 'x-correlation-id': 'payment-correlation' },
    })
    const api = createBlinkPayClient({ config: loadBlinkPayConfig('sandbox', sandboxEnv), sdkClient: sdk({ getPaymentAsync }) })
    await expect(api.getPayment('55555555-5555-4555-8555-555555555555')).resolves.toMatchObject({
      payment_id: '55555555-5555-4555-8555-555555555555', creation_timestamp: '2026-08-15T00:00:00.000Z',
      detail: { consent_id: '44444444-4444-4444-8444-444444444444' }, provider_correlation_id: 'payment-correlation',
    })
  })

  it('distinguishes definitive and ambiguous SDK mutation failures', async () => {
    const createEnduringConsentAsync = vi.fn()
      .mockRejectedValueOnce(new BlinkInvalidValueException('invalid'))
      .mockRejectedValueOnce(new BlinkServiceException('unavailable'))
    const api = createBlinkPayClient({
      config: loadBlinkPayConfig('sandbox', sandboxEnv), sdkClient: sdk({ createEnduringConsentAsync }),
      now: () => new Date('2026-08-15T00:00:00Z'),
    })
    const input = {
      type: 'enduring' as const, flow: { detail: { type: 'gateway' as const, redirect_uri: 'https://www.ev.church/give/return' } },
      from_timestamp: '2026-08-15T00:00:00Z', period: 'weekly' as const,
      maximum_amount_period: amount, maximum_amount_payment: amount,
    }
    await expect(api.createEnduringConsent(input, operationKeys)).rejects.toMatchObject({ code: 'request-rejected', status: 422 })
    await expect(api.createEnduringConsent(input, operationKeys)).resolves.toMatchObject({ outcome: 'unknown' })
  })

  it('fails closed when generic SDK credentials conflict with the selected environment', () => {
    const previous = process.env.BLINKPAY_CLIENT_ID
    process.env.BLINKPAY_CLIENT_ID = 'different-client'
    try { expect(() => createBlinkPayClient({ config: loadBlinkPayConfig('sandbox', sandboxEnv) })).toThrow(/configuration/i) }
    finally {
      if (previous === undefined) delete process.env.BLINKPAY_CLIENT_ID
      else process.env.BLINKPAY_CLIENT_ID = previous
    }
  })
})

describe('BlinkPay fixed-recurring API exception', () => {
  it('uses the direct endpoint only for fixed-recurring creation', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ fixed_recurring_payment_id: '66666666-6666-4666-8666-666666666666' }, 201))
    const api = directClient(fetchImpl as unknown as typeof fetch)
    await expect(api.createFixedRecurringPayment({
      consent_id: '44444444-4444-4444-8444-444444444444', consent_status: 'Authorised', period: 'monthly',
      start_date: '2026-09-01', amount, amount_minor: 1_234, maximum_amount_payment_minor: 1_234,
      maximum_amount_period_minor: 1_234, pcr, retry_strategy: 'same_day',
    }, operationKeys)).resolves.toMatchObject({ outcome: 'succeeded', value: { fixed_recurring_payment_id: '66666666-6666-4666-8666-666666666666' } })
    expect(new URL(fetchImpl.mock.calls[1][0]).pathname).toBe('/payments/v1/fixed-recurring-payments')
    expect(fetchImpl.mock.calls[1][1].headers['request-id']).toBe(operationKeys.requestId)
    expect(fetchImpl.mock.calls[1][1].headers['idempotency-key']).toBe(operationKeys.idempotencyKey)
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      consent_id: '44444444-4444-4444-8444-444444444444', start_date: '2026-09-01', amount, pcr, retry_strategy: 'same_day',
    })
  })

  it('reads and cancels fixed-recurring schedules through the direct endpoint', async () => {
    const schedule = {
      fixed_recurring_payment_id: '66666666-6666-4666-8666-666666666666', consent_id: '44444444-4444-4444-8444-444444444444',
      status: 'active', start_date: '2026-09-01', next_payment_date: '2026-09-01', amount, pcr,
      retry_strategy: 'none', creation_timestamp: '2026-08-15T00:00:00Z',
    }
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(schedule))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { 'x-correlation-id': 'cancel-correlation' } }))
    const api = directClient(fetchImpl as unknown as typeof fetch)
    await expect(api.getFixedRecurringPayment(schedule.fixed_recurring_payment_id)).resolves.toMatchObject(schedule)
    await expect(api.cancelFixedRecurringPayment(schedule.fixed_recurring_payment_id, operationKeys)).resolves.toMatchObject({ outcome: 'succeeded' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('returns unknown after an ambiguous fixed-recurring cancellation', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }))
    await expect(directClient(fetchImpl as unknown as typeof fetch).cancelFixedRecurringPayment(
      '66666666-6666-4666-8666-666666666666', operationKeys,
    )).resolves.toMatchObject({ outcome: 'unknown', reason: 'request-ambiguous' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid fixed-recurring input before calling BlinkPay', () => {
    const fetchImpl = vi.fn()
    const api = directClient(fetchImpl as unknown as typeof fetch)
    expect(() => api.createFixedRecurringPayment({
      consent_id: '44444444-4444-4444-8444-444444444444', consent_status: 'Authorised', period: 'monthly',
      start_date: '2026-08-14', amount, amount_minor: 1_234, maximum_amount_payment_minor: 1_234,
      maximum_amount_period_minor: 1_234, pcr,
    }, operationKeys)).toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
