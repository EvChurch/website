import { loadBlinkPayConfig } from './blinkpay/config'
import type { BlinkPayConfig } from './blinkpay/types'

export type GivingServerEligibility = 'production' | null
export interface GivingRuntimeConfiguration { eligibility: 'production'; gatewayOrigins: readonly string[] }

export function resolveGivingRuntimeConfiguration({ productionEnabled = process.env.BLINKPAY_PRODUCTION_ENABLED, productionConfig }: { productionEnabled?: string; productionConfig?: () => Readonly<BlinkPayConfig> } = {}): GivingRuntimeConfiguration | null {
  try {
    if (productionEnabled !== 'true') return null
    const config=(productionConfig ?? (()=>loadBlinkPayConfig('production')))()
    if (!config.productionEnabled || config.environment !== 'production') return null
    return {eligibility:'production',gatewayOrigins:config.gatewayOrigins}
  } catch { return null }
}
