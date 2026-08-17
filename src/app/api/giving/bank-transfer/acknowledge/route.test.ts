import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { handleGivingBankAcknowledgementPost, type GivingBankAcknowledgementDependencies } from './route'

const token = 'A'.repeat(43)

function request(value: unknown = { token }, headers: Record<string, string> = {}) {
  return new NextRequest('https://www.ev.church/api/giving/bank-transfer/acknowledge', {
    method: 'POST',
    headers: {
      origin: 'https://www.ev.church',
      'sec-fetch-site': 'same-origin',
      'x-ev-giving-request': 'bank-transfer-acknowledgement-v1',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(value),
  })
}

function dependencies(result = true): GivingBankAcknowledgementDependencies {
  return { acknowledge: vi.fn(async () => result) }
}

describe('POST giving bank setup acknowledgement', () => {
  it('records an idempotent self-reported setup without claiming payment verification', async () => {
    const deps = dependencies()
    const response = await handleGivingBankAcknowledgementPost(request(), deps)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ acknowledged: true, verified: false })
    expect(deps.acknowledge).toHaveBeenCalledWith(token)
  })

  it.each([
    request({ token: 'short' }),
    request({ token }, { origin: 'https://evil.test' }),
    request({ token }, { 'x-ev-giving-request': 'checkout-v1' }),
  ])('rejects invalid or untrusted acknowledgements uniformly', async (input) => {
    const deps = dependencies()
    const response = await handleGivingBankAcknowledgementPost(input, deps)
    expect([400, 403]).toContain(response.status)
    expect(deps.acknowledge).not.toHaveBeenCalled()
  })

  it('does not reveal expired or unknown capabilities', async () => {
    const response = await handleGivingBankAcknowledgementPost(request(), dependencies(false))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Giving unavailable' })
  })
})
