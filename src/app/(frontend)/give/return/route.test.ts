import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { handleGivingReturnGet, type GivingReturnDependencies } from './route'

const returnToken = 'A'.repeat(43)

function request(query = '?cid=provider-correlation', withCookie = true) {
  return new NextRequest(`https://www.ev.church/give/return${query}`, {
    headers: withCookie ? { cookie: `__Host-ev_giving_return=${returnToken}` } : {},
  })
}

function replayRequest(query: string, withReturnCookie = false) {
  const cookies = [`__Host-ev_giving_checkout=${'S'.repeat(43)}`]
  if (withReturnCookie) cookies.push(`__Host-ev_giving_return=${returnToken}`)
  return new NextRequest(`https://www.ev.church/give/return${query}`, {
    headers: { cookie: cookies.join('; ') },
  })
}

function dependencies(
  consume: GivingReturnDependencies['consume'],
  validateStatus: GivingReturnDependencies['validateStatus'] = vi.fn(async () => undefined),
): GivingReturnDependencies {
  return { consume, validateStatus, completionUrl: () => new URL('https://www.ev.church/?giving=return') }
}

describe('BlinkPay hosted return', () => {
  it('uses the secure return cookie with the fixed whitelisted callback path', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    const response = await handleGivingReturnGet(request(), dependencies(consume))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://www.ev.church/?giving=return')
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).toContain('__Host-ev_giving_checkout=')
    expect(cookies).toContain('__Host-ev_giving_return=;')
    expect(cookies.toLowerCase()).toContain('samesite=strict')
    expect(consume).toHaveBeenCalledWith(returnToken, null)
  })

  it('uses APP_BASE_URL instead of Railway internal request origin', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    const internalRequest = new NextRequest('https://localhost:3000/give/return?cid=provider-correlation', {
      headers: { cookie: `__Host-ev_giving_return=${returnToken}` },
    })

    const response = await handleGivingReturnGet(internalRequest, dependencies(consume))
    expect(response.headers.get('location')).toBe('https://www.ev.church/?giving=return')
  })

  it('loads and validates APP_BASE_URL on the production dependency path', async () => {
    const internalRequest = new NextRequest('https://localhost:3000/give/return?cid=provider-correlation', {
      headers: { cookie: `__Host-ev_giving_return=${returnToken}` },
    })
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    vi.stubEnv('APP_BASE_URL', 'https://www.ev.church')
    try {
      const response = await handleGivingReturnGet(internalRequest, { consume, validateStatus: vi.fn() })
      expect(response.headers.get('location')).toBe('https://www.ev.church/?giving=return')
    } finally {
      vi.unstubAllEnvs()
    }

    for (const invalid of ['https://www.ev.church/not-an-origin', 'http://www.ev.church']) {
      const invalidConsume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
      vi.stubEnv('APP_BASE_URL', invalid)
      try {
        expect((await handleGivingReturnGet(internalRequest, { consume: invalidConsume, validateStatus: vi.fn() })).status).toBe(404)
        expect(invalidConsume).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllEnvs()
      }
    }
  })

  it('requires the return cookie and accepts only one BlinkPay callback alias', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    expect((await handleGivingReturnGet(request('', true), dependencies(consume))).status).toBe(404)
    expect((await handleGivingReturnGet(request('?cid=abc', false), dependencies(consume))).status).toBe(404)
    for (const query of ['?consent_id=abc', '?cid=abc']) {
      expect((await handleGivingReturnGet(request(query), dependencies(consume))).status).toBe(303)
    }
    for (const query of ['?cid=a&cid=b', '?cid=a&consent_id=a', '?status=success', '?redirect=https://evil.test']) {
      expect((await handleGivingReturnGet(request(query), dependencies(consume))).status).toBe(404)
    }
  })

  it('accepts BlinkPay cancellation returns with a consent id and optional error message', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    const response = await handleGivingReturnGet(
      request('?cid=a0b3b75e-232f-4bf0-8a70-7bcb733db5ca&error=We+couldn%27t+process+your+payment+request'),
      dependencies(consume),
    )

    expect(response.status).toBe(303)
    expect(consume).toHaveBeenCalledWith(returnToken, null)
  })

  it('redirects a replayed BlinkPay decline when the checkout status capability remains', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    const validateStatus = vi.fn(async () => undefined)
    const response = await handleGivingReturnGet(
      replayRequest(
        '?cid=7f04b1de-c78c-4422-b92b-84e3f87606b5&error=The+payment+was+declined+and+you+were+not+charged',
        true,
      ),
      dependencies(consume, validateStatus),
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://www.ev.church/?giving=return')
    expect(validateStatus).toHaveBeenCalledWith('S'.repeat(43))
    expect(consume).not.toHaveBeenCalled()
  })

  it('rejects a replay whose checkout status capability does not exist', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    const validateStatus = vi.fn(async () => { throw new Error('Unavailable') })
    const response = await handleGivingReturnGet(
      replayRequest('?cid=7f04b1de-c78c-4422-b92b-84e3f87606b5'),
      dependencies(consume, validateStatus),
    )

    expect(response.status).toBe(404)
    expect(consume).not.toHaveBeenCalled()
  })
})
