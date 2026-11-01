import Stripe from 'stripe'
import type { GivingEnvironment } from '../contracts'
import { blinkPayCallbackOrigin } from '../blinkpay/config'

export interface StripeGivingConfig {
  environment: GivingEnvironment
  secretKey: string
  publishableKey: string
  webhookSecret: string
  origin: string
}

export function loadStripeGivingConfig(environment: GivingEnvironment): StripeGivingConfig {
  const prefix = environment === 'production' ? 'STRIPE_PRODUCTION_' : 'STRIPE_SANDBOX_'
  const secretKey = process.env[`${prefix}SECRET_KEY`]?.trim() ?? ''
  const publishableKey = process.env[`${prefix}PUBLISHABLE_KEY`]?.trim() ?? ''
  const webhookSecret = process.env[`${prefix}WEBHOOK_SECRET`]?.trim() ?? ''
  const mode = environment === 'production' ? 'live' : 'test'
  if (!secretKey.startsWith(`sk_${mode}_`) || !publishableKey.startsWith(`pk_${mode}_`) || !webhookSecret.startsWith('whsec_')) throw new Error('Stripe giving is not configured')
  return { environment, secretKey, publishableKey, webhookSecret, origin: blinkPayCallbackOrigin() }
}

export function stripeGivingAvailable(environment: GivingEnvironment | null): boolean {
  if (!environment || process.env.STRIPE_GIVING_ENABLED !== 'true') return false
  try { loadStripeGivingConfig(environment); return true } catch { return false }
}

export function getGivingStripe(environment: GivingEnvironment) {
  return new Stripe(loadStripeGivingConfig(environment).secretKey, { maxNetworkRetries: 2, timeout: 15_000 })
}
