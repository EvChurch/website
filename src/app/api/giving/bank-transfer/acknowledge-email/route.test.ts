import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { handleGivingEmailAcknowledgementPost, type GivingEmailAcknowledgementDependencies } from './route'

function request(value:unknown={token:'signed'}){return new NextRequest('https://www.ev.church/api/giving/bank-transfer/acknowledge-email',{method:'POST',headers:{origin:'https://www.ev.church','sec-fetch-site':'same-origin','content-type':'application/json','x-ev-giving-request':'bank-transfer-email-acknowledgement-v1'},body:JSON.stringify(value)})}
function dependencies():GivingEmailAcknowledgementDependencies{return{verify:vi.fn(()=>({checkoutId:42})),acknowledge:vi.fn(async()=>true)}}

describe('POST emailed bank setup acknowledgement',()=>{
  it('requires a signed token and records setup without claiming payment verification',async()=>{
    const deps=dependencies();const response=await handleGivingEmailAcknowledgementPost(request(),deps)
    expect(response.status).toBe(200);expect(await response.json()).toEqual({acknowledged:true,verified:false});expect(deps.acknowledge).toHaveBeenCalledWith(42)
  })
  it('does not mutate for invalid, expired, or cross-site requests',async()=>{
    const deps=dependencies();vi.mocked(deps.verify).mockReturnValue(null)
    expect((await handleGivingEmailAcknowledgementPost(request(),deps)).status).toBe(404)
    const cross=request();cross.headers.set('origin','https://evil.test')
    expect((await handleGivingEmailAcknowledgementPost(cross,deps)).status).toBe(403)
    expect(deps.acknowledge).not.toHaveBeenCalled()
  })
})
