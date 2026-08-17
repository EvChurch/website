import { describe, expect, it } from 'vitest'

import { resolveGivingRuntimeConfiguration } from './availability'

describe('giving runtime configuration', () => {
  it('uses sandbox by default without a second activation switch',()=>{
    const config={environment:'sandbox',gatewayOrigins:['https://sandbox.secure.blinkpay.co.nz']}
    expect(resolveGivingRuntimeConfiguration({config:()=>config as never})).toEqual({eligibility:'sandbox',gatewayOrigins:['https://sandbox.secure.blinkpay.co.nz']})
    expect(resolveGivingRuntimeConfiguration({config:()=>{throw new Error('missing')}})).toBeNull()
  })

  it('accepts an explicit production environment and fails closed on an invalid value',()=>{
    const config={environment:'production',gatewayOrigins:['https://secure.blinkpay.co.nz']}
    expect(resolveGivingRuntimeConfiguration({
      environment: 'production',
      config:()=>config as never,
    })).toEqual({eligibility:'production',gatewayOrigins:['https://secure.blinkpay.co.nz']})
    expect(resolveGivingRuntimeConfiguration({environment:'invalid'})).toBeNull()
  })
})
