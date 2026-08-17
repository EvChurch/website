import { describe, expect, it } from 'vitest'

import { resolveGivingRuntimeConfiguration } from './availability'

describe('giving runtime configuration', () => {
  it('keeps production closed until configuration has no blocking readiness diagnostics',()=>{
    const config={environment:'production',productionEnabled:true,gatewayOrigins:['https://merchant-gateway.example.nz'],readiness:[{code:'production-scopes',blocking:true,message:'unresolved'}]}
    expect(resolveGivingRuntimeConfiguration({productionEnabled:'true',productionConfig:()=>config as never})).toBeNull()
    expect(resolveGivingRuntimeConfiguration({productionEnabled:'true',productionConfig:()=>({...config,readiness:[]}) as never})).toEqual({eligibility:'production',gatewayOrigins:['https://merchant-gateway.example.nz']})
  })
})
