import {NextRequest} from 'next/server'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {GET} from './route'
const mocks=vi.hoisted(()=>({auth:vi.fn(),csv:vi.fn(),query:vi.fn(),connect:vi.fn()}))
vi.mock('@/lib/payload',()=>({getPayloadClient:async()=>({auth:mocks.auth,db:{pool:{query:mocks.query,connect:mocks.connect}}})}))
vi.mock('@/lib/giving/finance-export',()=>({givingFinanceCsv:mocks.csv}))
describe('giving finance export access',()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.csv.mockResolvedValue('"gift_cents"\r\n"10000"\r\n')})
  it.each([null,{id:1,roles:['editor']},{id:2,roles:['content-lead']}])('excludes anonymous and non-finance administrators',async(user)=>{
    mocks.auth.mockResolvedValue({user})
    expect((await GET(new NextRequest('https://www.ev.church/api/admin/giving/export'))).status).toBe(404)
    expect(mocks.csv).not.toHaveBeenCalled()
  })
  it('exports only for an exact administrator and passes the explicit date range',async()=>{
    mocks.auth.mockResolvedValue({user:{id:1,roles:['admin']}})
    const response=await GET(new NextRequest('https://www.ev.church/api/admin/giving/export?from=2026-10-01&to=2026-10-31'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(mocks.csv).toHaveBeenCalledWith(expect.any(Object),'2026-10-01','2026-10-31')
  })
})
