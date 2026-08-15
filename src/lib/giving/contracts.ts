export const GIVING_ENVIRONMENTS = ['sandbox', 'production'] as const
export type GivingEnvironment = (typeof GIVING_ENVIRONMENTS)[number]

export type GivingContext = {
  contextKey: string
  environment: GivingEnvironment
  synthetic: boolean
  e2eRunId: number | null
}

export const PAYMENT_STATUSES = ['pending', 'settled', 'failed', 'cancelled'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export const CONSENT_STATUSES = ['pending', 'authorised', 'revoked', 'expired', 'failed'] as const
export type ConsentStatus = (typeof CONSENT_STATUSES)[number]
export const SCHEDULE_STATUSES = ['pending', 'active', 'unknown', 'cancel_pending', 'cancelled', 'failed'] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]
export const PROVIDER_OPERATION_STATUSES = ['prepared', 'submitted', 'succeeded', 'unknown', 'failed'] as const
export type ProviderOperationStatus = (typeof PROVIDER_OPERATION_STATUSES)[number]
export const PROVIDER_OPERATION_PROVIDERS = ['rock', 'blinkpay'] as const
export type ProviderOperationProvider = (typeof PROVIDER_OPERATION_PROVIDERS)[number]
export const PROVIDER_OPERATION_ACTIONS = [
  'rock.resolve-giver', 'rock.create-giver', 'blinkpay.create-payment',
  'blinkpay.create-consent', 'blinkpay.create-schedule', 'blinkpay.cancel-schedule',
] as const
export type ProviderOperationAction = (typeof PROVIDER_OPERATION_ACTIONS)[number]

export interface ProviderOperationAttempt {
  attemptNumber: number
  attemptedAt: string
  outcome: 'submitted' | 'succeeded' | 'unknown' | 'failed'
  providerRequestId?: string
  errorCode?: string
}

export interface PublicGivingFund {
  id: number
  name: string
  code: string
  sortOrder: number
  isDefault: boolean
}

export const GIVING_CHECKOUT_STATUS_STATES = ['processing','cancelled','rejected','expired','unknown','verified'] as const
export type GivingCheckoutStatusState = typeof GIVING_CHECKOUT_STATUS_STATES[number]
export interface GivingCheckoutStatus { state:GivingCheckoutStatusState;retryAllowed:boolean;kind:'one-off'|'recurring' }
export function parseGivingCheckoutStatus(value:unknown):GivingCheckoutStatus {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid giving checkout status')
  const item=value as Record<string,unknown>
  if(Object.keys(item).sort().join(',')!=='kind,retryAllowed,state'||!GIVING_CHECKOUT_STATUS_STATES.includes(item.state as GivingCheckoutStatusState)||typeof item.retryAllowed!=='boolean'||!['one-off','recurring'].includes(String(item.kind)))throw new Error('Invalid giving checkout status')
  return item as unknown as GivingCheckoutStatus
}
