import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGivingBankAcknowledgementUrl, verifyGivingBankAcknowledgementToken } from './email-links'

describe('giving bank acknowledgement email links', () => {
  afterEach(()=>vi.unstubAllEnvs())

  it('creates a thirty-day signed HTTPS link and rejects tampering or expiry', () => {
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET','s'.repeat(32))
    vi.stubEnv('APP_BASE_URL','https://www.ev.church')
    const now=new Date('2026-08-22T00:00:00Z')
    const url=new URL(createGivingBankAcknowledgementUrl(42,now))
    const token=url.searchParams.get('token')!
    expect(url.origin+url.pathname).toBe('https://www.ev.church/give/bank-transfer/confirm')
    expect(verifyGivingBankAcknowledgementToken(token,now)).toMatchObject({checkoutId:42})
    expect(verifyGivingBankAcknowledgementToken(`43${token.slice(2)}`,now)).toBeNull()
    expect(verifyGivingBankAcknowledgementToken(token,new Date('2026-09-22T00:00:01Z'))).toBeNull()
  })

  it('fails closed without strong secrets or the canonical HTTPS origin', () => {
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET','short')
    vi.stubEnv('APP_BASE_URL','http://www.ev.church')
    expect(()=>createGivingBankAcknowledgementUrl(1)).toThrow()
  })
})
