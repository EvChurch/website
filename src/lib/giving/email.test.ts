import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildGivingEmail, createResendGivingEmailTransport, deliverGivingEmail, type GivingEmailSource } from './email'

function source(kind: GivingEmailSource['kind']): GivingEmailSource {
  return {id:7,checkoutId:42,kind,email:'ada@example.com',name:'Ada Lovelace',bankReference:'EV123',bankCode:'ALOVELACE',fundCode:'GEN',fundName:'General',amountMinor:2500,transactionFeeMinor:50,frequency:'one-off',firstPaymentDate:null,leaseToken:'lease'}
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

  it('accepts a safe acknowledgement URL for local previews',()=>{
    const acknowledgementUrl='http://localhost:3000/dev/giving-emails#bank-transfer-thanks'
    const message=buildGivingEmail(source('bank-transfer-details'),new Date('2026-08-22T00:00:00Z'),{acknowledgementUrl})
    expect(message.html).toContain(acknowledgementUrl)
    expect(message.text).toContain(acknowledgementUrl)
  })

  it('escapes giver and fund fields in HTML thank-you emails',()=>{
    const message=buildGivingEmail({
      ...source('blinkpay-thanks'),
      name:'<Ada> Lovelace',
      fundName:'General <script>alert("x")</script>',
    })
    expect(message.html).toContain('Hi &lt;Ada&gt;')
    expect(message.html).toContain('General &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(message.html).not.toContain('<script>')
  })

  it('distinguishes self-reported setup thanks from verified BlinkPay thanks',()=>{
    const bank=buildGivingEmail(source('bank-transfer-thanks'))
    expect(bank.subject).toBe('Thank you for setting up your gift to Ev Church')
    expect(bank.text).toContain('hasn’t verified a payment yet')
    expect(bank.text).toContain('Gift setup: $25.00 plus a $0.50 transaction fee to General, just this once')
    const blink=buildGivingEmail(source('blinkpay-thanks'))
    expect(blink.subject).toBe('Thank you for your gift to Ev Church')
    expect(blink.text).toContain('Your gift is confirmed')
    expect(blink.text).toContain('Confirmed gift: $25.00 plus a $0.50 transaction fee to General, just this once')
    expect(blink.text).toContain('Thank you for your partnership in the gospel.')
    expect(blink.text).toContain('We thank God for you and for the generosity you’ve shown.')
    expect(blink.text).toContain('people across Auckland can hear about Jesus, grow in him, and be equipped to serve')
    expect(blink.text).toContain('“I thank my God every time I remember you… because of your partnership in the gospel from the first day until now.” — Philippians 1:3–5')
    expect(blink.html).toContain('<blockquote style="border-left:4px solid #E22A30')
    expect(blink.text).not.toContain('Our system registered')
    expect(blink.text).not.toContain('What next')
    expect(blink.text).not.toContain('22 people')
    expect(blink.text).toContain('Hi Ada')
    expect(blink.text.match(/Ada/gu)).toHaveLength(1)
    expect(blink.text).toContain('God bless,\n\nSteve Mullins\nOn behalf of the Executive Committee of Ev Church: https://www.ev.church/give#executive-committee')
    expect(blink.text).not.toContain('Dewald Gilfillan')
    expect(blink.html).toContain('<strong>Steve Mullins</strong>')
    expect(blink.html).toContain('<a href="https://www.ev.church/give#executive-committee"')
    expect(blink.html).not.toContain('Dewald Gilfillan')
    expect(blink.html).toContain('<p style="margin-bottom:24px">God bless,</p>')
    expect(blink.html.match(/vertical-align:middle/gu)).toHaveLength(2)
    expect(blink.html).toContain('src="https://www.ev.church/api/media/file/steve-mullins-1.jpg"')
    expect(blink.html).toContain('height:64px;overflow:hidden;width:64px')
    expect(blink.html).toContain('alt="Steve Mullins" width="107" height="160"')
    expect(blink.html).toContain('margin-left:-22px')
    expect(blink.html).toContain('margin-top:-8px')

    const recurring=buildGivingEmail({...source('blinkpay-thanks'),frequency:'monthly'})
    expect(recurring.subject).toBe('Thank you for your regular giving to Ev Church')
    expect(recurring.text).toContain('Confirmed gift: $25.00 plus a $0.50 transaction fee to General each month')
    expect(recurring.text).toContain('Thank you for your faithful partnership in the gospel.')
    expect(recurring.text).toContain('your regular commitment to gospel ministry through Ev')
    expect(recurring.text).not.toContain('What next')

    const recurringBank=buildGivingEmail({...source('bank-transfer-thanks'),frequency:'monthly'})
    expect(recurringBank.subject).toBe('Thank you for setting up regular giving to Ev Church')
    expect(recurringBank.text).toContain('hasn’t verified a payment yet')
    expect(recurringBank.text).not.toContain('recurring gift is confirmed')
  })

  it('leaves zero-fee gifts with the existing amount wording',()=>{
    const message=buildGivingEmail({...source('blinkpay-thanks'),transactionFeeMinor:0})
    expect(message.text).toContain('Confirmed gift: $25.00 to General, just this once')
    expect(message.text).not.toContain('transaction fee')
  })

  it('sends through Resend with a stable idempotency key and bounded message',async()=>{
    vi.stubEnv('RESEND_API_KEY','secret');vi.stubEnv('GIVING_EMAIL_FROM','Ev Church <giving@ev.church>')
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'email-1'}),{status:200,headers:{'content-type':'application/json'}}))
    const transport=createResendGivingEmailTransport(fetch)
    await expect(transport.send({to:'ada@example.com',subject:'Thank you',text:'Thanks',html:'<p>Thanks</p>'},'giving/42/blinkpay-thanks')).resolves.toEqual({providerId:'email-1'})
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails',expect.objectContaining({headers:expect.objectContaining({'Idempotency-Key':'giving/42/blinkpay-thanks'})}))
  })

  it('leases once, sends once, and records the provider id',async()=>{
    const claimed={id:7,checkout_id:42,kind:'blinkpay-thanks',email:'ada@example.com',name:'Ada Lovelace',bank_reference:'EV123',bank_code:'ALOVELACE',fund_code:'GEN',fund_name:'General',amount_minor:2500,transaction_fee_minor:50,frequency:'one-off',first_payment_date:null}
    const query=vi.fn().mockResolvedValueOnce({rows:[claimed]}).mockResolvedValueOnce({rowCount:1})
    const transport={send:vi.fn().mockResolvedValue({providerId:'email-1'})}
    await expect(deliverGivingEmail({id:7,pool:{query} as never,transport,now:new Date('2026-08-22T00:00:00Z')})).resolves.toEqual({sent:true})
    expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({to:'ada@example.com'}),'giving/42/blinkpay-thanks')
    expect(String(query.mock.calls[0][0])).toContain("checkout.environment='production' AND checkout.synthetic=false")
    expect(String(query.mock.calls[1][0])).toContain("status='sent'")
  })

  it('releases provider failures but preserves the lease after an accepted send cannot be recorded',async()=>{
    const claimed={id:7,checkout_id:42,kind:'blinkpay-thanks',email:'ada@example.com',name:'Ada Lovelace',bank_reference:'EV123',bank_code:'ALOVELACE',fund_code:'GEN',fund_name:'General',amount_minor:2500,transaction_fee_minor:50,frequency:'one-off',first_payment_date:null}
    const providerQuery=vi.fn().mockResolvedValueOnce({rows:[claimed]}).mockResolvedValueOnce({rowCount:1})
    await expect(deliverGivingEmail({id:7,pool:{query:providerQuery} as never,transport:{send:vi.fn().mockRejectedValue(new Error('provider'))}})).rejects.toThrow('Giving email delivery failed')
    expect(String(providerQuery.mock.calls[1][0])).toContain("attempt_count>=")

    const stateQuery=vi.fn().mockResolvedValueOnce({rows:[claimed]}).mockRejectedValueOnce(new Error('database'))
    await expect(deliverGivingEmail({id:7,pool:{query:stateQuery} as never,transport:{send:vi.fn().mockResolvedValue({providerId:'accepted'})}})).rejects.toThrow('Giving email state update failed')
    expect(stateQuery).toHaveBeenCalledTimes(2)
  })
})
