import {NextRequest} from 'next/server'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {POST} from './route'
const mocks=vi.hoisted(()=>({actor:vi.fn(),query:vi.fn(),connect:vi.fn(),create:vi.fn()}))
vi.mock('@/app/api/member/giving/auth',()=>({requireMemberGivingActor:mocks.actor,MEMBER_GIVING_PRIVATE_HEADERS:{'Cache-Control':'private, no-store'}}))
vi.mock('@/lib/payload',()=>({getPayloadClient:async()=>({db:{pool:{query:mocks.query,connect:mocks.connect}}})}))
vi.mock('@/lib/giving/stripe/config',()=>({getGivingStripe:()=>({checkout:{sessions:{create:mocks.create}}}),loadStripeGivingConfig:()=>({origin:'https://www.ev.church'})}))
const request=(origin='https://www.ev.church')=>new NextRequest('https://www.ev.church/api/member/giving/schedules/7/card',{method:'POST',headers:{origin}})
const context={params:Promise.resolve({id:'7'})}
describe('member card update ownership',()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.actor.mockResolvedValue({rockPersonAliasId:123,email:'ada@example.com'});mocks.query.mockResolvedValue({rows:[]})})
  it('rejects another origin and unauthenticated requests before provider work',async()=>{
    expect((await POST(request('https://evil.test'),context)).status).toBe(400)
    mocks.actor.mockResolvedValue(null)
    expect((await POST(request(),context)).status).toBe(401)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('requires an active Stripe arrangement belonging to the authenticated donor',async()=>{
    expect((await POST(request(),context)).status).toBe(404)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.query.mock.calls[0][0]).toContain("schedule.payment_provider='stripe' AND schedule.status='active'")
    expect(mocks.query.mock.calls[0][1]).toContain(123)
    expect(mocks.query.mock.calls[0][1]).toContain('ada@example.com')
  })
  it('creates only a setup session and binds its callback to the owned arrangement',async()=>{
    mocks.query.mockResolvedValueOnce({rows:[{customer_id:'cus_owned'}]}).mockResolvedValueOnce({rows:[]})
    mocks.create.mockResolvedValue({id:'cs_update',url:'https://checkout.stripe.com/c/test'})
    const response=await POST(request(),context)
    expect(response.status).toBe(200)
    expect(mocks.create.mock.calls[0][0]).toMatchObject({mode:'setup',customer:'cus_owned'})
    expect(mocks.query.mock.calls[1][0]).toContain('giving_stripe_card_updates')
  })
})
