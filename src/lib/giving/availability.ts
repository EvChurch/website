import { loadBlinkPayConfig } from './blinkpay/config'
import type { BlinkPayConfig } from './blinkpay/types'

export type GivingServerEligibility = 'production' | 'protected-e2e' | null
export interface GivingRuntimeConfiguration { eligibility: Exclude<GivingServerEligibility,null>; gatewayOrigins: readonly string[]; synthetic: boolean }

export function resolveGivingRuntimeConfiguration({ protectedE2E = false, productionEnabled = process.env.BLINKPAY_PRODUCTION_ENABLED, productionConfig, sandboxConfig }: { protectedE2E?: boolean; productionEnabled?: string; productionConfig?: () => Readonly<BlinkPayConfig>;sandboxConfig?:()=>Readonly<BlinkPayConfig> } = {}): GivingRuntimeConfiguration | null {
  try {
    if(protectedE2E){
      const config=(sandboxConfig??(()=>loadBlinkPayConfig('sandbox')))()
      if(config.environment!=='sandbox'||config.readiness.some((item)=>item.blocking))return null
      return {eligibility:'protected-e2e',gatewayOrigins:config.gatewayOrigins,synthetic:true}
    }
    if (productionEnabled !== 'true') return null
    const config=(productionConfig ?? (()=>loadBlinkPayConfig('production')))()
    if (!config.productionEnabled || config.environment !== 'production' || config.readiness.some((item)=>item.blocking)) return null
    return {eligibility:'production',gatewayOrigins:config.gatewayOrigins,synthetic:false}
  } catch { return null }
}
