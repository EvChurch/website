import { describe, expect, it } from 'vitest'

import { resolveGivingRuntimeConfiguration } from './availability'

describe('giving runtime configuration', () => {
  it('keeps production closed until configuration has no blocking readiness diagnostics',()=>{
    const config={environment:'production',productionEnabled:true,gatewayOrigins:['https://merchant-gateway.example.nz'],readiness:[{code:'production-scopes',blocking:true,message:'unresolved'}]}
    expect(resolveGivingRuntimeConfiguration({productionEnabled:'true',productionConfig:()=>config as never})).toBeNull()
    expect(resolveGivingRuntimeConfiguration({productionEnabled:'true',productionConfig:()=>({...config,readiness:[]}) as never})).toEqual({eligibility:'production',gatewayOrigins:['https://merchant-gateway.example.nz'],synthetic:false})
    const sandbox={...config,environment:'sandbox',productionEnabled:false,gatewayOrigins:['https://sandbox.debit.blinkpay.co.nz'],readiness:[]}
    expect(resolveGivingRuntimeConfiguration({protectedE2E:true,sandboxConfig:()=>sandbox as never})).toEqual({eligibility:'protected-e2e',gatewayOrigins:['https://sandbox.debit.blinkpay.co.nz'],synthetic:true})
  })

  it('fails closed when protected E2E sandbox configuration cannot load',()=>{
    expect(resolveGivingRuntimeConfiguration({protectedE2E:true,sandboxConfig:()=>{throw new Error('missing credentials')}})).toBeNull()
  })
})
