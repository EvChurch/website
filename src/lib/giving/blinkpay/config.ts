import type { GivingEnvironment } from '../contracts'
import type { BlinkPayConfig, BlinkPayReadinessDiagnostic } from './types'

const ORIGINS = {
  sandbox: 'https://sandbox.debit.blinkpay.co.nz',
  production: 'https://debit.blinkpay.co.nz',
} as const

const CALLBACK_ORIGIN = 'https://www.ev.church' as const
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

export class BlinkPayConfigurationError extends Error {
  constructor(public readonly code: 'configuration-invalid' | 'production-not-ready', detail?: string) {
    super(detail ? `BlinkPay configuration failed: ${detail}` : `BlinkPay configuration failed: ${code}`)
    this.name = 'BlinkPayConfigurationError'
  }
}

function requiredSecret(value: string | undefined) {
  if (!value || CONTROL_CHARACTERS.test(value)) throw new BlinkPayConfigurationError('configuration-invalid')
  return value
}

function optionalSecrets(value: string | undefined) {
  if (!value) return Object.freeze([] as string[])
  const secrets = value.split(',').map((secret) => secret.trim())
  if (secrets.some((secret) => !secret || CONTROL_CHARACTERS.test(secret))) {
    throw new BlinkPayConfigurationError('configuration-invalid')
  }
  return Object.freeze(secrets)
}

function exactOptionalUrl(value: string | undefined, expected: string) {
  if (value !== undefined && value !== '' && value.replace(/\/+$/u, '') !== expected) {
    throw new BlinkPayConfigurationError('configuration-invalid')
  }
}

function exactHttpsOrigin(value: string | undefined) {
  if (!value) throw new BlinkPayConfigurationError('production-not-ready', 'Production hosted Gateway origin is required')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new BlinkPayConfigurationError('configuration-invalid')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new BlinkPayConfigurationError('configuration-invalid')
  }
  return url.origin
}

export function blinkPayProductionReadiness(): readonly BlinkPayReadinessDiagnostic[] {
  return Object.freeze([
    { code: 'consent-create-recovery', blocking: true, message: 'Confirm merchant-supported recovery for ambiguous enduring-consent creation.' },
    { code: 'fixed-recurring-create-recovery', blocking: true, message: 'Confirm merchant-supported recovery for ambiguous fixed-recurring-payment creation.' },
    { code: 'production-gateway-origin', blocking: true, message: 'Record the tenant-proven exact production hosted Gateway origin.' },
    { code: 'production-scopes', blocking: true, message: 'Confirm the exact production OAuth scopes issued to this merchant.' },
    { code: 'return-aliases', blocking: true, message: 'Confirm production callback aliases registered during merchant onboarding.' },
  ])
}

export function loadBlinkPayConfig(
  environment: GivingEnvironment,
  env: Record<string, string | undefined> = process.env,
): Readonly<BlinkPayConfig> {
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new BlinkPayConfigurationError('configuration-invalid')
  }

  const origin = ORIGINS[environment]
  const prefix = environment === 'sandbox' ? 'BLINKPAY_SANDBOX' : 'BLINKPAY_PRODUCTION'
  exactOptionalUrl(env[`${prefix}_OAUTH_URL`], `${origin}/oauth2/token`)
  exactOptionalUrl(env[`${prefix}_API_URL`], origin)

  const gatewayOrigin = environment === 'sandbox'
    ? (() => {
        const configured = env.BLINKPAY_SANDBOX_GATEWAY_URL
        if (configured) exactOptionalUrl(configured, ORIGINS.sandbox)
        return ORIGINS.sandbox
      })()
    : exactHttpsOrigin(env.BLINKPAY_PRODUCTION_GATEWAY_URL)

  const config: BlinkPayConfig = {
    environment,
    oauthTokenUrl: `${origin}/oauth2/token`,
    apiBaseUrl: `${origin}/payments/v1/`,
    gatewayOrigins: Object.freeze([gatewayOrigin]),
    callbackOrigin: CALLBACK_ORIGIN,
    clientId: requiredSecret(env[`${prefix}_CLIENT_ID`]),
    clientSecret: requiredSecret(env[`${prefix}_CLIENT_SECRET`]),
    webhookSecrets: optionalSecrets(env[`${prefix}_WEBHOOK_SECRETS`] ?? env[`${prefix}_WEBHOOK_SECRET`]),
    productionEnabled: environment === 'production' && env.BLINKPAY_PRODUCTION_ENABLED === 'true',
    readiness: environment === 'production' ? blinkPayProductionReadiness() : Object.freeze([]),
  }
  return Object.freeze(config)
}
