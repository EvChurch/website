import { describe, expect, it } from 'vitest'

import { resolveGivingRuntimeConfiguration } from './availability'

describe('giving runtime configuration', () => {
  it('uses the server environment switch without additional readiness diagnostics',()=>{
    const config={environment:'production',productionEnabled:true,gatewayOrigins:['https://merchant-gateway.example.nz']}
    expect(resolveGivingRuntimeConfiguration({productionEnabled:'true',productionConfig:()=>config as never})).toEqual({eligibility:'production',gatewayOrigins:['https://merchant-gateway.example.nz']})
    expect(resolveGivingRuntimeConfiguration({productionEnabled:'false',productionConfig:()=>config as never})).toBeNull()
  })
})
