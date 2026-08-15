import posthog from 'posthog-js'

export const GIVING_FLAG_KEY = 'launcher-giving-pilot'

export type GivingAnalyticsStep =
  | 'amount'
  | 'fund'
  | 'frequency'
  | 'starting-date'
  | 'identity'
  | 'review'
  | 'authorising'
  | 'result'

export type GivingAnalyticsFrequency =
  | 'one-off'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'other'

export type GivingAnalyticsOutcome =
  | 'started'
  | 'continued'
  | 'returned'
  | 'verified'
  | 'failed'
  | 'cancelled'

export type GivingElapsedBucket =
  | 'under-30s'
  | '30-59s'
  | '1-2m'
  | '2-5m'
  | 'over-5m'

export interface GivingAnalyticsProperties {
  step?: GivingAnalyticsStep
  frequency?: GivingAnalyticsFrequency
  outcome?: GivingAnalyticsOutcome
  elapsed_bucket?: GivingElapsedBucket
  synthetic: boolean
}

export type GivingAnalyticsEvent =
  | 'giving_flow_started'
  | 'giving_step_viewed'
  | 'giving_provider_returned'
  | 'giving_outcome_verified'

const DENIED_KEY_PARTS = new Set([
  'amount',
  'fund',
  'name',
  'email',
  'alias',
  'reference',
  'provider',
  'blink',
  'blinkpay',
  'payment',
  'consent',
  'schedule',
  'error',
  'exception',
  'stack',
  'stacktrace',
  'capability',
  'token',
  'secret',
  'account',
  'bank',
])
const TOKEN_SHAPED_VALUE = /^(?:eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{32,})$/i

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return TOKEN_SHAPED_VALUE.test(value) ? undefined : value
  }
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value
      .map(sanitizeValue)
      .filter((item) => item !== undefined)
  }
  if (typeof value !== 'object') return undefined

  const sanitized: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    const keyParts = key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
    if (keyParts.some((part) => DENIED_KEY_PARTS.has(part))) continue
    const safeValue = sanitizeValue(nestedValue)
    if (safeValue !== undefined) sanitized[key] = safeValue
  }
  return sanitized
}

export function sanitizeAnalyticsPayload<T>(payload: T): T {
  return sanitizeValue(payload) as T
}

export function trackGivingEvent(
  event: GivingAnalyticsEvent,
  properties: GivingAnalyticsProperties,
): void {
  if (typeof window === 'undefined') return
  const safeProperties = sanitizeAnalyticsPayload(properties)
  posthog.capture(event, safeProperties)
  window.gtag?.('event', event, safeProperties)
}
