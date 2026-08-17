import { loadBlinkPayConfig } from './blinkpay/config'
import type { GivingEnvironment } from './contracts'
import type { BlinkPayConfig } from './blinkpay/types'

export type GivingServerEligibility = GivingEnvironment | null
export interface GivingRuntimeConfiguration { eligibility: GivingEnvironment; gatewayOrigins: readonly string[] }

export function configuredGivingEnvironment(value = process.env.BLINKPAY_DEFAULT_ENVIRONMENT): GivingEnvironment | null {
  if (!value || value === 'sandbox') return 'sandbox'
  if (value === 'production') return 'production'
  return null
}

export function resolveGivingRuntimeConfiguration({
  environment: configuredEnvironment,
  config,
}: {
  environment?: string
  config?: (environment: GivingEnvironment) => Readonly<BlinkPayConfig>
} = {}): GivingRuntimeConfiguration | null {
  try {
    const environment = configuredGivingEnvironment(configuredEnvironment)
    if (!environment) return null
    const resolved = (config ?? loadBlinkPayConfig)(environment)
    if (resolved.environment !== environment) return null
    return { eligibility: environment, gatewayOrigins: resolved.gatewayOrigins }
  } catch { return null }
}
