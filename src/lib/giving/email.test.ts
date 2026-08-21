import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildGivingEmail, createResendGivingEmailTransport, deliverGivingEmail, type GivingEmailSource } from './email'

function source(kind: GivingEmailSource['kind']): GivingEmailSource {
  return {id:7,checkoutId:42,kind,email:'ada@example.com',name:'Ada Lovelace',bankReference:'EV123',bankCode:'ALOVELACE',fundCode:'GEN',fundName:'General',amountMinor:2500,frequency:'one-off',firstPaymentDate:null,leaseToken:'lease'}
}

describe('giving emails',()=>{
  afterEach(()=>vi.unstubAllEnvs())

  it('emails exact manual details with a signed confirmation link and no payment claim',()=>{
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET','s'.repeat(32));vi.stubEnv('APP_BASE_URL','https://www.ev.church')
    const message=buildGivingEmail(source('bank-transfer-details'),new Date('2026-08-22T00:00:00Z'))
    expect(message.subject).not.toContain('$')
    expect(message.text).toContain('Account number: 01-1845-0008260-05')
    expect(message.text).toContain('Reference: EV123')
    expect(message.text).toContain('/give/bank-transfer/confirm?token=')
    expect(message.text).toContain('cannot verify a manual bank transfer')
  })

  it('distinguishes self-reported setup thanks from verified BlinkPay thanks',()=>{
    expect(buildGivingEmail(source('bank-transfer-thanks')).text).toContain('hasn’t verified a payment yet')
    const blink=buildGivingEmail(source('blinkpay-thanks'))
    expect(blink.text).toContain('Your gift is confirmed')
    expect(blink.text).toContain('2 Corinthians 9:7')
    expect(blink.text).toContain('Thank you, Ada')
  })

  it('sends through Resend with a stable idempotency key and bounded message',async()=>{
    vi.stubEnv('RESEND_API_KEY','secret');vi.stubEnv('GIVING_EMAIL_FROM','Ev Church <giving@ev.church>')
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'email-1'}),{status:200,headers:{'content-type':'application/json'}}))
    const transport=createResendGivingEmailTransport(fetch)
    await expect(transport.send({to:'ada@example.com',subject:'Thank you',text:'Thanks',html:'<p>Thanks</p>'},'giving/42/blinkpay-thanks')).resolves.toEqual({providerId:'email-1'})
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails',expect.objectContaining({headers:expect.objectContaining({'Idempotency-Key':'giving/42/blinkpay-thanks'})}))
  })

  it('leases once, sends once, and records the provider id',async()=>{
    const claimed={id:7,checkout_id:42,kind:'blinkpay-thanks',email:'ada@example.com',name:'Ada Lovelace',bank_reference:'EV123',bank_code:'ALOVELACE',fund_code:'GEN',fund_name:'General',amount_minor:2500,frequency:'one-off',first_payment_date:null}
    const query=vi.fn().mockResolvedValueOnce({rows:[claimed]}).mockResolvedValueOnce({rowCount:1})
    const transport={send:vi.fn().mockResolvedValue({providerId:'email-1'})}
    await expect(deliverGivingEmail({id:7,pool:{query} as never,transport,now:new Date('2026-08-22T00:00:00Z')})).resolves.toEqual({sent:true})
    expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({to:'ada@example.com'}),'giving/42/blinkpay-thanks')
    expect(String(query.mock.calls[0][0])).toContain("checkout.environment='production' AND checkout.synthetic=false")
    expect(String(query.mock.calls[1][0])).toContain("status='sent'")
  })

  it('releases provider failures but preserves the lease after an accepted send cannot be recorded',async()=>{
    const claimed={id:7,checkout_id:42,kind:'blinkpay-thanks',email:'ada@example.com',name:'Ada Lovelace',bank_reference:'EV123',bank_code:'ALOVELACE',fund_code:'GEN',fund_name:'General',amount_minor:2500,frequency:'one-off',first_payment_date:null}
    const providerQuery=vi.fn().mockResolvedValueOnce({rows:[claimed]}).mockResolvedValueOnce({rowCount:1})
    await expect(deliverGivingEmail({id:7,pool:{query:providerQuery} as never,transport:{send:vi.fn().mockRejectedValue(new Error('provider'))}})).rejects.toThrow('Giving email delivery failed')
    expect(String(providerQuery.mock.calls[1][0])).toContain("attempt_count>=")

    const stateQuery=vi.fn().mockResolvedValueOnce({rows:[claimed]}).mockRejectedValueOnce(new Error('database'))
    await expect(deliverGivingEmail({id:7,pool:{query:stateQuery} as never,transport:{send:vi.fn().mockResolvedValue({providerId:'accepted'})}})).rejects.toThrow('Giving email state update failed')
    expect(stateQuery).toHaveBeenCalledTimes(2)
  })
})
