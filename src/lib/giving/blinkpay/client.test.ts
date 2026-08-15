import { describe, expect, it, vi } from 'vitest'

import { BlinkPayClientError, createBlinkPayClient } from './client'
import { BlinkPayConfigurationError, loadBlinkPayConfig } from './config'

const sandboxEnv = {
  BLINKPAY_SANDBOX_CLIENT_ID: 'sandbox-id',
  BLINKPAY_SANDBOX_CLIENT_SECRET: 'sandbox-secret',
  BLINKPAY_SANDBOX_WEBHOOK_SECRET: 'sandbox-webhook',
  BLINKPAY_PRODUCTION_CLIENT_ID: 'production-id',
  BLINKPAY_PRODUCTION_CLIENT_SECRET: 'production-secret',
  BLINKPAY_PRODUCTION_WEBHOOK_SECRET: 'production-webhook',
}

function json(value: unknown, status = 200, correlation = 'provider-correlation') {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'x-correlation-id': correlation },
  })
}

function client(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  let correlation = 0
  return createBlinkPayClient({
    config: loadBlinkPayConfig('sandbox', sandboxEnv), fetchImpl,
    now: () => new Date('2026-08-15T00:00:00Z'), sleep: vi.fn(async () => undefined),
    uuid: vi.fn().mockReturnValueOnce('request-id').mockReturnValueOnce('idempotency-key').mockImplementation(() => `correlation-${correlation += 1}`),
    ...overrides,
  })
}

const token = { access_token: 'access-token', token_type: 'Bearer', expires_in: 3600, scope: 'view:payment' }
const amount = { total: '12.34', currency: 'NZD' as const }
const pcr = { particulars: 'EV123', code: 'GENERAL', reference: 'DONATION' }
const operationKeys = { requestId: 'test-request-id-0001', idempotencyKey: 'test-idempotency-key-0001' }

describe('BlinkPay configuration', () => {
  it('hard-codes exact environment origins and loads only selected credentials', () => {
    const config = loadBlinkPayConfig('sandbox', new Proxy(sandboxEnv, {
      get(target, property: string) {
        if (property.startsWith('BLINKPAY_PRODUCTION_')) throw new Error('cross-loaded production credential')
        return target[property as keyof typeof target]
      },
    }))
    expect(config.oauthTokenUrl).toBe('https://sandbox.debit.blinkpay.co.nz/oauth2/token')
    expect(config.apiBaseUrl).toBe('https://sandbox.debit.blinkpay.co.nz/payments/v1/')
    expect(config.gatewayOrigins).toEqual(['https://sandbox.debit.blinkpay.co.nz'])
    expect(Object.isFrozen(config)).toBe(true)
  })

  it('does not require webhook signing configuration for API-only use', () => {
    const config = loadBlinkPayConfig('sandbox', {
      BLINKPAY_SANDBOX_CLIENT_ID: 'sandbox-id',
      BLINKPAY_SANDBOX_CLIENT_SECRET: 'sandbox-secret',
    })
    expect(config.webhookSecrets).toEqual([])
  })

  it('rejects URL overrides and reports unresolved production activation blockers', () => {
    expect(() => loadBlinkPayConfig('sandbox', {
      ...sandboxEnv,
      BLINKPAY_SANDBOX_API_URL: 'https://evil.test',
    })).toThrow(BlinkPayConfigurationError)
    expect(() => loadBlinkPayConfig('production', sandboxEnv)).toThrow(/gateway origin/i)

    const production = loadBlinkPayConfig('production', new Proxy({
      BLINKPAY_PRODUCTION_CLIENT_ID: 'production-id',
      BLINKPAY_PRODUCTION_CLIENT_SECRET: 'production-secret',
      BLINKPAY_PRODUCTION_WEBHOOK_SECRET: 'production-webhook',
      BLINKPAY_PRODUCTION_GATEWAY_URL: 'https://merchant-gateway.example.nz',
    }, {
      get(target, property: string) {
        if (property.startsWith('BLINKPAY_SANDBOX_')) throw new Error('cross-loaded sandbox credential')
        return target[property as keyof typeof target]
      },
    }))
    expect(production.apiBaseUrl).toBe('https://debit.blinkpay.co.nz/payments/v1/')
    expect(production.gatewayOrigins).toEqual(['https://merchant-gateway.example.nz'])
  })
})

describe('BlinkPay client', () => {
  it('uses caller-owned request and idempotency keys for a financial create', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(json({
        quick_payment_id: '11111111-1111-4111-8111-111111111111',
        redirect_uri: 'https://sandbox.debit.blinkpay.co.nz/gateway/quick',
      }, 201))
    const api = client(fetchImpl as unknown as typeof fetch)

    await api.createQuickPayment({
      type: 'single',
      flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } },
      amount,
      pcr,
    }, {
      requestId: 'checkout-payment-request-0001',
      idempotencyKey: 'checkout-payment-idempotency-0001',
    })

    expect(fetchImpl.mock.calls[1][1].headers['request-id']).toBe('checkout-payment-request-0001')
    expect(fetchImpl.mock.calls[1][1].headers['idempotency-key']).toBe('checkout-payment-idempotency-0001')
  })

  it('single-flights concurrent OAuth and refreshes five minutes before expiry without requesting scope', async () => {
    const fetchImpl = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith('/oauth2/token')) return json(token)
      return json({ payment_id: '11111111-1111-4111-8111-111111111111', type: 'single', status: 'Pending', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: { consent_id: '22222222-2222-4222-8222-222222222222' }, refunds: [] })
    }) as unknown as typeof fetch
    const api = client(fetchImpl)
    await Promise.all([
      api.getPayment('11111111-1111-4111-8111-111111111111'),
      api.getPayment('11111111-1111-4111-8111-111111111111'),
    ])
    const tokenCalls = vi.mocked(fetchImpl).mock.calls.filter(([url]) => String(url).endsWith('/oauth2/token'))
    expect(tokenCalls).toHaveLength(1)
    const tokenInit = tokenCalls[0][1]!
    expect(tokenInit.redirect).toBe('error')
    expect(String(tokenInit.body)).toBe('grant_type=client_credentials&client_id=sandbox-id&client_secret=sandbox-secret')
    expect(String(tokenInit.body)).not.toContain('scope=')
  })

  it('refreshes a cached token five minutes before expiry', async () => {
    let nowMs = Date.parse('2026-08-15T00:00:00Z')
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ ...token, access_token: 'first-token', expires_in: 600 }))
      .mockResolvedValueOnce(json({ payment_id: '11111111-1111-4111-8111-111111111111', type: 'single', status: 'Pending', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, refunds: [] }))
      .mockResolvedValueOnce(json({ ...token, access_token: 'second-token', expires_in: 600 }))
      .mockResolvedValueOnce(json({ payment_id: '11111111-1111-4111-8111-111111111111', type: 'single', status: 'Pending', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, refunds: [] }))
    const api = client(fetchImpl as unknown as typeof fetch, { now: () => new Date(nowMs) })
    await api.getPayment('11111111-1111-4111-8111-111111111111')
    nowMs += 301_000
    await api.getPayment('11111111-1111-4111-8111-111111111111')
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/oauth2/token'))).toHaveLength(2)
  })

  it('retries token network and 5xx failures with bounded backoff and clears the failed single-flight', async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(json({ error: 'down' }, 503))
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(json({ payment_id: '11111111-1111-4111-8111-111111111111', type: 'single', status: 'Pending', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, refunds: [] }))
    const api = client(fetchImpl as unknown as typeof fetch, { sleep })
    await expect(api.getPayment('11111111-1111-4111-8111-111111111111')).resolves.toMatchObject({ status: 'Pending' })
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/oauth2/token'))).toHaveLength(3)
    expect(sleep).toHaveBeenCalledTimes(2)

    const rejected = vi.fn().mockResolvedValue(json({ error: 'bad credentials' }, 400))
    const rejectedApi = client(rejected as unknown as typeof fetch, { sleep: vi.fn(async () => undefined) })
    await expect(rejectedApi.getPayment('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ status: 400 })
    await expect(rejectedApi.getPayment('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ status: 400 })
    expect(rejected).toHaveBeenCalledTimes(2)
  })

  it('refreshes once after 401 and rebuilds Authorization with stable request IDs and a fresh correlation ID', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(json({ error: 'unauthorised' }, 401))
      .mockResolvedValueOnce(json({ ...token, access_token: 'fresh-token' }))
      .mockResolvedValueOnce(json({ quick_payment_id: '11111111-1111-4111-8111-111111111111', consent: { consent_id: '22222222-2222-4222-8222-222222222222', status: 'GatewayAwaitingSubmission', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, payments: [] } }))
    const api = client(fetchImpl as unknown as typeof fetch)
    await api.getQuickPayment('11111111-1111-4111-8111-111111111111')
    const first = fetchImpl.mock.calls[1][1]
    const second = fetchImpl.mock.calls[3][1]
    expect(first.headers['request-id']).toBe(second.headers['request-id'])
    expect(first.headers['idempotency-key']).toBe(second.headers['idempotency-key'])
    expect(first.headers['x-correlation-id']).not.toBe(second.headers['x-correlation-id'])
    expect(first.headers.Authorization).toBe('Bearer access-token')
    expect(second.headers.Authorization).toBe('Bearer fresh-token')
  })

  it('retries bounded GET 5xx but never retries a timed-out or malformed successful create', async () => {
    const fetchGet = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(json({ error: 'down' }, 503))
      .mockResolvedValueOnce(json({ payment_id: '11111111-1111-4111-8111-111111111111', type: 'single', status: 'Pending', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, refunds: [] }))
    await client(fetchGet as unknown as typeof fetch).getPayment('11111111-1111-4111-8111-111111111111')
    expect(fetchGet).toHaveBeenCalledTimes(3)

    const fetchCreate = vi.fn().mockResolvedValueOnce(json(token)).mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
    await expect(client(fetchCreate as unknown as typeof fetch).createQuickPayment({
      type: 'single', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } }, amount, pcr,
    }, operationKeys)).resolves.toMatchObject({ outcome: 'unknown', reason: 'request-ambiguous' })
    expect(fetchCreate).toHaveBeenCalledTimes(2)

    const malformed = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(new Response('{bad', { status: 201, headers: { 'content-type': 'application/json' } }))
    await expect(client(malformed as unknown as typeof fetch).createQuickPayment({
      type: 'single', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } }, amount, pcr,
    }, operationKeys)).resolves.toMatchObject({ outcome: 'unknown', reason: 'response-invalid' })
    expect(malformed).toHaveBeenCalledTimes(2)
  })

  it('uses representative exact quick, enduring and fixed recurring bodies and validates returned gateway URLs', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(json({ quick_payment_id: '11111111-1111-4111-8111-111111111111', redirect_uri: 'https://sandbox.debit.blinkpay.co.nz/gateway/quick' }, 201))
      .mockResolvedValueOnce(json({ consent_id: '22222222-2222-4222-8222-222222222222', redirect_uri: 'https://sandbox.debit.blinkpay.co.nz/gateway/consent' }, 201))
      .mockResolvedValueOnce(json({ fixed_recurring_payment_id: '33333333-3333-4333-8333-333333333333' }, 201))
    const api = client(fetchImpl as unknown as typeof fetch)
    await api.createQuickPayment({ type: 'single', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } }, amount, pcr }, operationKeys)
    await api.createEnduringConsent({ type: 'enduring', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } }, from_timestamp: '2026-08-15T00:00:00Z', period: 'monthly', maximum_amount_period: amount, maximum_amount_payment: amount }, operationKeys)
    await api.createFixedRecurringPayment({
      consent_id: '22222222-2222-4222-8222-222222222222', consent_status: 'Authorised',
      period: 'monthly', start_date: '2026-09-01', amount, amount_minor: 1_234,
      maximum_amount_payment_minor: 1_234, maximum_amount_period_minor: 1_234,
      pcr, retry_strategy: 'same_day',
    }, operationKeys)
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({ type: 'single', flow: { detail: { type: 'gateway' } }, amount, pcr })
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toMatchObject({ type: 'enduring', period: 'monthly', maximum_amount_period: amount, maximum_amount_payment: amount })
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toEqual({ consent_id: '22222222-2222-4222-8222-222222222222', start_date: '2026-09-01', amount, pcr, retry_strategy: 'same_day' })
  })

  it('treats a hosted create without redirect_uri as an unknown invalid success', async () => {
    const quickFetch = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ quick_payment_id: '11111111-1111-4111-8111-111111111111' }, 201))
    await expect(client(quickFetch as unknown as typeof fetch).createQuickPayment({
      type: 'single', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } }, amount, pcr,
    }, operationKeys)).resolves.toMatchObject({ outcome: 'unknown', reason: 'response-invalid' })

    const consentFetch = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ consent_id: '22222222-2222-4222-8222-222222222222' }, 201))
    await expect(client(consentFetch as unknown as typeof fetch).createEnduringConsent({
      type: 'enduring', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } },
      from_timestamp: '2026-08-15T00:00:00Z', expiry_timestamp: '2026-09-15T00:00:00Z',
      period: 'monthly', maximum_amount_period: amount, maximum_amount_payment: amount,
    }, operationKeys)).resolves.toMatchObject({ outcome: 'unknown', reason: 'response-invalid' })
  })

  it('rejects invalid enduring limits and expiry before fetching', () => {
    const fetchImpl = vi.fn()
    const api = client(fetchImpl as unknown as typeof fetch)
    expect(() => api.createEnduringConsent({
      type: 'enduring', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } },
      from_timestamp: '2026-08-15T00:00:00Z', expiry_timestamp: '2026-08-14T23:59:59Z',
      period: 'monthly', maximum_amount_period: { total: '10.00', currency: 'NZD' }, maximum_amount_payment: { total: '12.34', currency: 'NZD' },
    }, operationKeys)).toThrow(/configuration/i)
    expect(fetchImpl).not.toHaveBeenCalled()

    expect(() => api.createEnduringConsent({
      type: 'enduring', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } },
      from_timestamp: '2026-08-15T00:00:00Z', expiry_timestamp: '2026-09-15T00:00:00Z',
      period: 'monthly', maximum_amount_period: { total: '10.00', currency: 'NZD' }, maximum_amount_payment: { total: '12.34', currency: 'NZD' },
    }, operationKeys)).toThrow(/configuration/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['past date', { period: 'monthly' as const, start_date: '2026-08-14', amount_minor: 1_234, maximum_amount_payment_minor: 1_234, maximum_amount_period_minor: 1_234 }],
    ['daily cutoff', { period: 'daily' as const, start_date: '2026-08-15', amount_minor: 1_234, maximum_amount_payment_minor: 1_234, maximum_amount_period_minor: 1_234 }],
    ['payment limit', { period: 'monthly' as const, start_date: '2026-09-01', amount_minor: 1_234, maximum_amount_payment_minor: 1_000, maximum_amount_period_minor: 2_000 }],
  ])('rejects an invalid fixed recurring %s before fetching', (_label, local) => {
    const fetchImpl = vi.fn()
    const api = client(fetchImpl as unknown as typeof fetch, {
      now: () => _label === 'daily cutoff' ? new Date('2026-08-15T09:46:00Z') : new Date('2026-08-15T00:00:00Z'),
    })
    expect(() => api.createFixedRecurringPayment({
      consent_id: '22222222-2222-4222-8222-222222222222', consent_status: 'Authorised',
      ...local, amount, pcr, retry_strategy: 'none',
    }, operationKeys)).toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('preserves unknown statuses without treating them as settled or active', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(json({ payment_id: '11111111-1111-4111-8111-111111111111', type: 'single', status: 'FutureStatus', creation_timestamp: '2026-08-15T00:00:00Z', status_updated_timestamp: '2026-08-15T00:00:00Z', detail: {}, refunds: [], additive: true }))
      .mockResolvedValueOnce(json({ fixed_recurring_payment_id: '33333333-3333-4333-8333-333333333333', consent_id: '22222222-2222-4222-8222-222222222222', status: 'paused', start_date: '2026-09-01', next_payment_date: '2026-09-01', amount, pcr, retry_strategy: 'none', creation_timestamp: '2026-08-15T00:00:00Z' }))
    const api = client(fetchImpl as unknown as typeof fetch)
    expect((await api.getPayment('11111111-1111-4111-8111-111111111111')).status).toBe('FutureStatus')
    expect(api.isPaymentSettled({ status: 'FutureStatus' })).toBe(false)
    const schedule = await api.getFixedRecurringPayment('33333333-3333-4333-8333-333333333333')
    expect(schedule.status).toBe('paused')
    expect(api.isFixedRecurringPaymentActive(schedule)).toBe(false)
  })

  it('returns unknown cancellation on timeout/5xx and never retries DELETE', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ error: 'down' }, 503))
    await expect(client(fetchImpl as unknown as typeof fetch).cancelFixedRecurringPayment('33333333-3333-4333-8333-333333333333', operationKeys)).resolves.toMatchObject({ outcome: 'unknown', reason: 'request-ambiguous' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('accepts only the documented 204 cancellation response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { 'x-correlation-id': 'cancel-correlation' } }))
    const result = await client(fetchImpl as unknown as typeof fetch).cancelFixedRecurringPayment('33333333-3333-4333-8333-333333333333', operationKeys)
    expect(result).toMatchObject({ outcome: 'succeeded', metadata: { correlationId: 'cancel-correlation' } })
    expect(new URL(fetchImpl.mock.calls[1][0]).pathname).toBe('/payments/v1/fixed-recurring-payments/33333333-3333-4333-8333-333333333333')
    expect(fetchImpl.mock.calls[1][1].method).toBe('DELETE')
  })

  it('sanitizes provider failures and rejects poisoned response redirects', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ secret: 'provider-secret-body' }, 400))
    const error = await client(fetchImpl as unknown as typeof fetch).getPayment('11111111-1111-4111-8111-111111111111').catch((caught) => caught)
    expect(error).toBeInstanceOf(BlinkPayClientError)
    expect(String(error)).not.toContain('provider-secret-body')

    const poisoned = vi.fn().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ quick_payment_id: '11111111-1111-4111-8111-111111111111', redirect_uri: 'https://sandbox.debit.blinkpay.co.nz.evil.test/gateway' }, 201))
    await expect(client(poisoned as unknown as typeof fetch).createQuickPayment({ type: 'single', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } }, amount, pcr }, operationKeys)).resolves.toMatchObject({ outcome: 'unknown', reason: 'response-invalid' })
  })

  it('requires bounded JSON for token, read and mutation responses without exposing bodies', async () => {
    const tokenFetch = vi.fn().mockResolvedValue(new Response('token-secret-body', { status: 200, headers: { 'content-type': 'text/plain' } }))
    const tokenError = await client(tokenFetch as unknown as typeof fetch).getPayment('11111111-1111-4111-8111-111111111111').catch((caught) => caught)
    expect(tokenError).toMatchObject({ code: 'response-invalid' })
    expect(String(tokenError)).not.toContain('token-secret-body')

    const readFetch = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(new Response('{"secret":"read-body"}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(64 * 1024 + 1) } }))
    const readError = await client(readFetch as unknown as typeof fetch).getPayment('11111111-1111-4111-8111-111111111111').catch((caught) => caught)
    expect(readError).toMatchObject({ code: 'response-invalid' })
    expect(String(readError)).not.toContain('read-body')

    const mutationFetch = vi.fn()
      .mockResolvedValueOnce(json(token))
      .mockResolvedValueOnce(new Response('mutation-secret-body', { status: 201, headers: { 'content-type': 'text/plain' } }))
    await expect(client(mutationFetch as unknown as typeof fetch).createQuickPayment({
      type: 'single', flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } }, amount, pcr,
    }, operationKeys)).resolves.toMatchObject({ outcome: 'unknown', reason: 'response-invalid' })
  })
})
