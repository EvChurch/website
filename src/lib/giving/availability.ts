import { loadBlinkPayConfig } from './blinkpay/config'
import type { BlinkPayConfig } from './blinkpay/types'

export type GivingServerEligibility = 'production' | null
export interface GivingRuntimeConfiguration { eligibility: 'production'; gatewayOrigins: readonly string[] }

export function resolveGivingRuntimeConfiguration({ productionConfig }: { productionConfig?: () => Readonly<BlinkPayConfig> } = {}): GivingRuntimeConfiguration | null {
  try {
    const config=(productionConfig ?? (()=>loadBlinkPayConfig('production')))()
    if (config.environment !== 'production') return null
    return {eligibility:'production',gatewayOrigins:config.gatewayOrigins}
  } catch { return null }
}
