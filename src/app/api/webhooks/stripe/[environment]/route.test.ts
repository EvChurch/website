import Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const db=vi.hoisted(()=>({query:vi.fn(),connect:vi.fn()}))
const signingSecret='whsec_test_signing_secret'
const stripe=new Stripe('sk_test_not_a_real_key')
vi.mock('@/lib/payload',()=>({getPayloadClient:async()=>({db:{pool:db}})}))
vi.mock('@/lib/giving/stripe/config',()=>({getGivingStripe:()=>new Stripe('sk_test_not_a_real_key'),loadStripeGivingConfig:()=>({webhookSecret:'whsec_test_signing_secret'})}))

function request(raw:string,signature?:string) {
  return new NextRequest('https://www.ev.church/api/webhooks/stripe/sandbox',{method:'POST',headers:signature?{'stripe-signature':signature}:{},body:raw})
}
const context={params:Promise.resolve({environment:'sandbox'})}
describe('Stripe signed webhook boundary',()=>{
  beforeEach(()=>db.query.mockReset().mockResolvedValue({rows:[],rowCount:1}))
  it('persists a verified raw event before acknowledging delivery',async()=>{
    const raw=JSON.stringify({id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test',object:'checkout.session'}}})
    const signature=stripe.webhooks.generateTestHeaderString({payload:raw,secret:signingSecret})
    expect((await POST(request(raw,signature),context)).status).toBe(200)
    expect(db.query).toHaveBeenCalledOnce()
    expect(db.query.mock.calls[0][1].slice(0,3)).toEqual(['sandbox','evt_test','checkout.session.completed'])
  })
  it('rejects changed payloads, expired signatures, and a mismatched environment before persistence',async()=>{
    const raw=JSON.stringify({id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{}}})
    const signature=stripe.webhooks.generateTestHeaderString({payload:raw,secret:signingSecret})
    expect((await POST(request(raw+' ',signature),context)).status).toBe(400)
    const expired=stripe.webhooks.generateTestHeaderString({payload:raw,secret:signingSecret,timestamp:Math.floor(Date.now()/1000)-600})
    expect((await POST(request(raw,expired),context)).status).toBe(400)
    const live=raw.replace('"livemode":false','"livemode":true')
    expect((await POST(request(live,stripe.webhooks.generateTestHeaderString({payload:live,secret:signingSecret})),context)).status).toBe(400)
    expect(db.query).not.toHaveBeenCalled()
  })
  it('bounds the body before parsing or writing an event',async()=>{
    expect((await POST(request('x'.repeat(262145),'signature'),context)).status).toBe(413)
    expect(db.query).not.toHaveBeenCalled()
  })
})
