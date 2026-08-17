import { describe, expect, it } from 'vitest'

import { resolveGivingRuntimeConfiguration } from './availability'

describe('giving runtime configuration', () => {
  it('uses valid production configuration without a second activation switch',()=>{
    const config={environment:'production',gatewayOrigins:['https://merchant-gateway.example.nz']}
    expect(resolveGivingRuntimeConfiguration({productionConfig:()=>config as never})).toEqual({eligibility:'production',gatewayOrigins:['https://merchant-gateway.example.nz']})
    expect(resolveGivingRuntimeConfiguration({productionConfig:()=>{throw new Error('missing')}})).toBeNull()
  })
})
