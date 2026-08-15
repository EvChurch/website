export type GivingServerEligibility = 'production' | 'protected-e2e' | null

export function resolveGivingServerEligibility({
  productionEnabled = process.env.BLINKPAY_PRODUCTION_ENABLED,
  protectedE2E = false,
}: {
  productionEnabled?: string
  protectedE2E?: boolean
} = {}): GivingServerEligibility {
  if (protectedE2E) return 'protected-e2e'
  return productionEnabled === 'true' ? 'production' : null
}
