import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import type { GivingCheckoutSubmission } from '@/lib/giving/service'
import { handleGivingPreviewCheckoutPost, previewOperationKeys, type GivingPreviewCheckoutDependencies } from './route'

const body: GivingCheckoutSubmission = {
  submissionKey: 'A'.repeat(43),
  amountMinor: 2500,
  fundId: 1,
  frequency: 'one-off',
  firstPaymentDate: null,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  turnstileToken: 'test-token',
}

function request(origin = 'http://localhost:3000') {
  return new NextRequest(`${origin}/api/giving/preview-checkouts`, {
    method: 'POST',
    headers: {
      origin,
      'sec-fetch-site': 'same-origin',
      'x-ev-giving-request': 'checkout-preview-v1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function requestWith(value: unknown) {
  return new NextRequest('http://localhost:3000/api/giving/preview-checkouts', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'x-ev-giving-request': 'checkout-preview-v1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(value),
  })
}

function dependencies(): GivingPreviewCheckoutDependencies {
  return {
    development: true,
    start: vi.fn(async () => ({ outcome: 'redirect' as const, gatewayRedirectUri: 'https://sandbox.debit.blinkpay.co.nz/gateway/example' })),
  }
}

describe('POST giving preview checkout', () => {
  it('starts a development-only Sandbox handoff from localhost', async () => {
    const deps = dependencies()
    const response = await handleGivingPreviewCheckoutPost(request(), deps)

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      outcome: 'redirect',
      gatewayRedirectUri: 'https://sandbox.debit.blinkpay.co.nz/gateway/example',
    })
    expect(deps.start).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'one-off', amountMinor: 2500 }), 'http://localhost:3000')
  })

  it('is unavailable outside development and from non-local origins', async () => {
    const disabled = dependencies()
    disabled.development = false
    expect((await handleGivingPreviewCheckoutPost(request(), disabled)).status).toBe(404)
    expect(disabled.start).not.toHaveBeenCalled()

    const remote = dependencies()
    expect((await handleGivingPreviewCheckoutPost(request('https://www.ev.church'), remote)).status).toBe(404)
    expect(remote.start).not.toHaveBeenCalled()
  })

  it('returns a non-retryable unknown outcome without inventing a redirect', async () => {
    const deps = dependencies()
    vi.mocked(deps.start).mockResolvedValue({ outcome: 'unknown', retryAllowed: false })
    const response = await handleGivingPreviewCheckoutPost(request(), deps)

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ outcome: 'unknown', retryAllowed: false })
  })

  it.each([
    { ...body, amountMinor: 99 },
    { ...body, frequency: 'daily', firstPaymentDate: '2026-08-17' },
    { ...body, frequency: 'monthly', firstPaymentDate: '2020-01-01' },
  ])('rejects values the preview UI cannot submit', async (invalid) => {
    const deps = dependencies()
    expect((await handleGivingPreviewCheckoutPost(requestWith(invalid), deps)).status).toBe(400)
    expect(deps.start).not.toHaveBeenCalled()
  })

  it('reuses keys for the same provider request and changes them after an edit', () => {
    const keys = previewOperationKeys(body)
    expect(keys).toEqual(previewOperationKeys({ ...body }))
    expect(keys.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    expect(keys.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    expect(previewOperationKeys(body)).not.toEqual(previewOperationKeys({ ...body, amountMinor: 2600 }))
    expect(previewOperationKeys(body)).not.toEqual(previewOperationKeys({ ...body, frequency: 'monthly', firstPaymentDate: '2026-08-17' }))
    expect(previewOperationKeys(body)).not.toEqual(previewOperationKeys({ ...body, lastName: 'Byron' }))
  })
})
