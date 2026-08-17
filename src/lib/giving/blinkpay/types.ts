import type { GivingEnvironment } from '../contracts'

export const BLINKPAY_PERIODS = ['daily', 'weekly', 'fortnightly', 'monthly', 'annual'] as const
export type BlinkPayPeriod = (typeof BLINKPAY_PERIODS)[number]

export interface BlinkPayAmount {
  total: string
  currency: 'NZD'
}

export interface BlinkPayPcr {
  particulars: string
  code?: string
  reference?: string
}

export interface BlinkPayGatewayFlow {
  detail: {
    type: 'gateway'
    redirect_uri: string
  }
}

export interface CreateQuickPaymentRequest {
  type: 'single'
  flow: BlinkPayGatewayFlow
  pcr: BlinkPayPcr
  amount: BlinkPayAmount
  hashed_customer_identifier?: string
}

export interface CreateQuickPaymentResponse {
  quick_payment_id: string
  redirect_uri: string
}

export interface CreateEnduringConsentRequest {
  type: 'enduring'
  flow: BlinkPayGatewayFlow
  from_timestamp: string
  expiry_timestamp?: string
  period: BlinkPayPeriod
  maximum_amount_period: BlinkPayAmount
  maximum_amount_payment: BlinkPayAmount
  hashed_customer_identifier?: string
}

export interface CreateEnduringConsentResponse {
  consent_id: string
  redirect_uri: string
}

export interface BlinkPayPayment {
  payment_id: string
  type: string
  status: string
  accepted_reason?: string
  creation_timestamp: string
  status_updated_timestamp: string
  detail: Record<string, unknown>
  refunds: unknown[]
  provider_correlation_id?: string
}

export interface BlinkPayConsent {
  consent_id: string
  status: string
  creation_timestamp: string
  status_updated_timestamp: string
  detail: Record<string, unknown>
  payments: BlinkPayPayment[]
  provider_correlation_id?: string
}

export interface BlinkPayQuickPayment {
  quick_payment_id: string
  consent: BlinkPayConsent
  provider_correlation_id?: string
}

export type BlinkPayRetryStrategy = 'none' | 'same_day'

export interface CreateFixedRecurringPaymentRequest {
  consent_id: string
  /** Used for the local Authorised gate and deliberately omitted from the wire body. */
  consent_status: string
  /** Local validation inputs. They are deliberately omitted from the wire body. */
  period: BlinkPayPeriod
  amount_minor: number
  maximum_amount_payment_minor: number
  maximum_amount_period_minor: number
  start_date: string
  amount: BlinkPayAmount
  pcr: BlinkPayPcr
  retry_strategy?: BlinkPayRetryStrategy
}

export interface CreateFixedRecurringPaymentResponse {
  fixed_recurring_payment_id: string
}

export interface BlinkPayFixedRecurringPayment {
  fixed_recurring_payment_id: string
  consent_id: string
  status: string
  start_date: string
  next_payment_date: string
  amount: BlinkPayAmount
  pcr: BlinkPayPcr
  retry_strategy: BlinkPayRetryStrategy
  creation_timestamp: string
  status_updated_timestamp?: string
  provider_correlation_id?: string
}

export interface BlinkPayOperationMetadata {
  requestId: string
  idempotencyKey: string
  correlationId?: string
  tokenScope?: string
}

export interface BlinkPayOperationKeys {
  requestId: string
  idempotencyKey: string
}

export type BlinkPayMutationResult<T> =
  | { outcome: 'succeeded'; value: T; metadata: BlinkPayOperationMetadata }
  | { outcome: 'unknown'; reason: 'request-ambiguous' | 'response-invalid'; metadata: BlinkPayOperationMetadata }

export interface BlinkPayReadinessDiagnostic {
  code: 'consent-create-recovery' | 'fixed-recurring-create-recovery' | 'production-gateway-origin' | 'production-scopes' | 'return-aliases'
  blocking: true
  message: string
}

export interface BlinkPayConfig {
  environment: GivingEnvironment
  oauthTokenUrl: string
  apiBaseUrl: string
  gatewayOrigins: readonly string[]
  callbackOrigin: string
  clientId: string
  clientSecret: string
  webhookSecrets: readonly string[]
  productionEnabled: boolean
  readiness: readonly BlinkPayReadinessDiagnostic[]
}

export interface BlinkPayAccessToken {
  accessToken: string
  tokenType: 'Bearer'
  expiresAtMs: number
  scope?: string
}
