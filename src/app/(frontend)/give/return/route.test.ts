import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { handleGivingReturnGet } from './route'

const returnToken = 'A'.repeat(43)

function request(query = '?cid=provider-correlation', withCookie = true) {
  return new NextRequest(`https://www.ev.church/give/return${query}`, {
    headers: withCookie ? { cookie: `__Host-ev_giving_return=${returnToken}` } : {},
  })
}

describe('BlinkPay hosted return', () => {
  it('uses the secure return cookie with the fixed whitelisted callback path', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    const response = await handleGivingReturnGet(request(), { consume })

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://www.ev.church/?giving=return')
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).toContain('__Host-ev_giving_checkout=')
    expect(cookies).toContain('__Host-ev_giving_return=;')
    expect(cookies.toLowerCase()).toContain('samesite=strict')
    expect(consume).toHaveBeenCalledWith(returnToken, 'provider-correlation')
  })

  it('requires the return cookie and accepts only one provider correlation alias', async () => {
    const consume = vi.fn(async () => ({ statusToken: 'S'.repeat(43), checkoutId: 1 }))
    expect((await handleGivingReturnGet(request('', true), { consume })).status).toBe(404)
    expect((await handleGivingReturnGet(request('?cid=abc', false), { consume })).status).toBe(404)
    for (const query of ['?consent_id=abc', '?cid=abc']) {
      expect((await handleGivingReturnGet(request(query), { consume })).status).toBe(303)
    }
    for (const query of ['?cid=a&cid=b', '?cid=a&consent_id=a', '?status=success', '?redirect=https://evil.test']) {
      expect((await handleGivingReturnGet(request(query), { consume })).status).toBe(404)
    }
  })
})
