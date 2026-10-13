import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handleGivingBankTransferPost, type GivingBankTransferRouteDependencies } from './route'

const body = {
  submissionKey: 'A'.repeat(43),
  amountMinor: 2500,
  transactionFeeMinor: 0,
  fundId: 1,
  frequency: 'one-off',
  firstPaymentDate: null,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  turnstileToken: 'token',
}

function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new NextRequest('https://www.ev.church/api/giving/bank-transfer', {
    method: 'POST',
    headers: {
      origin: 'https://www.ev.church',
      'sec-fetch-site': 'same-origin',
      'x-ev-giving-request': 'bank-transfer-v1',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(value),
  })
}

function dependencies(): GivingBankTransferRouteDependencies {
  return {
    rateLimitStore: { increment: vi.fn(async () => 1) },
    verifyTurnstile: vi.fn(async () => undefined),
    prepare: vi.fn(async () => ({
      accountName: 'Auckland Evangelical Church Trust',
      accountNumber: '01-1845-0008260-05',
      particulars: 'GENERAL',
      code: 'ALOVELACE',
      reference: 'EV123',
      acknowledgementToken: 'A'.repeat(43),
      checkoutId: 42,
      emailDeliveryId: 7,
    })),
  }
}

describe('POST giving bank transfer', () => {
  beforeEach(() => vi.stubEnv('GIVING_RATE_LIMIT_SECRET', 'r'.repeat(32)))

  it('applies the same abuse controls and returns private exact bank instructions', async () => {
    const deps = dependencies()
    const response = await handleGivingBankTransferPost(request(), deps)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(deps.verifyTurnstile).toHaveBeenCalledOnce()
    expect(vi.mocked(deps.verifyTurnstile).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.rateLimitStore.increment).mock.invocationCallOrder[0],
    )
    expect(deps.prepare).toHaveBeenCalledOnce()
    const result=await response.json()
    expect(result).toEqual(expect.objectContaining({ reference: 'EV123', particulars: 'GENERAL' }))
    expect(result).not.toEqual(expect.objectContaining({ checkoutId:expect.anything(),emailDeliveryId:expect.anything() }))
  })

  it.each<Record<string, string>>([
    { origin: 'https://evil.test' },
    { 'sec-fetch-site': 'cross-site' },
    { 'x-ev-giving-request': 'checkout-v1' },
  ])('rejects untrusted mutations before identity work', async (header) => {
    const deps = dependencies()
    const response = await handleGivingBankTransferPost(request(body, header), deps)
    expect(response.status).toBe(403)
    expect(deps.prepare).not.toHaveBeenCalled()
  })

  it('rejects mass assignment before identity work', async () => {
    const deps = dependencies()
    const response = await handleGivingBankTransferPost(request({ ...body, environment: 'sandbox' }), deps)
    expect(response.status).toBe(400)
    expect(deps.prepare).not.toHaveBeenCalled()
  })

  it('returns a private rate-limit response with retry guidance', async () => {
    const deps = dependencies()
    vi.mocked(deps.rateLimitStore.increment).mockImplementation(async ({ scope }) => scope === 'identity' ? 11 : 1)
    const response = await handleGivingBankTransferPost(request(), deps)
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(deps.verifyTurnstile).toHaveBeenCalledOnce()
    expect(deps.prepare).not.toHaveBeenCalled()
  })

  it('fails closed when the security check is unavailable', async () => {
    const deps = dependencies()
    vi.mocked(deps.verifyTurnstile).mockRejectedValue(new Error('turnstile unavailable'))
    const response = await handleGivingBankTransferPost(request(), deps)
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(deps.rateLimitStore.increment).not.toHaveBeenCalled()
    expect(deps.prepare).not.toHaveBeenCalled()
  })

  it('keeps identity and Rock failures private', async () => {
    const deps = dependencies()
    vi.mocked(deps.prepare).mockRejectedValue(new Error('rock unavailable'))
    const response = await handleGivingBankTransferPost(request(), deps)
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ error: 'Giving unavailable' })
  })
})
