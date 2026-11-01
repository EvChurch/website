import { loadBlinkPayConfig } from './blinkpay/config'
import type { GivingEnvironment } from './contracts'
import type { BlinkPayConfig } from './blinkpay/types'
import type { CardFeeSettings } from './fees'
import { loadStripeGivingConfig, stripeGivingAvailable } from './stripe/config'

export type GivingServerEligibility = GivingEnvironment | null
export interface GivingRuntimeConfiguration { eligibility: GivingEnvironment; gatewayOrigins: readonly string[]; bankAvailable?: boolean; card?: { publishableKey: string; fees: CardFeeSettings } }

export function resolveGivingPaymentRuntimeConfiguration(cardFees: CardFeeSettings | null): GivingRuntimeConfiguration | null {
  const bank = resolveGivingRuntimeConfiguration()
  const environment = configuredGivingEnvironment()
  const card = cardFees && stripeGivingAvailable(environment) && environment
    ? { publishableKey: loadStripeGivingConfig(environment).publishableKey, fees: cardFees } : undefined
  if (!bank && !card) return null
  return { eligibility: environment!, gatewayOrigins: bank?.gatewayOrigins ?? [], bankAvailable: bank !== null, ...(card ? { card } : {}) }
}

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
