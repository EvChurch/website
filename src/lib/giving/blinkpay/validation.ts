import { BLINKPAY_PERIODS, type BlinkPayPcr, type BlinkPayPeriod } from './types'

const PCR_PATTERN = /^[A-Za-z0-9 /?():.,'+&#_-]{1,12}$/u
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u
const ISO_OFFSET_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u

export class BlinkPayValidationError extends Error {
  constructor(message: string) {
    super(`Invalid BlinkPay ${message}`)
    this.name = 'BlinkPayValidationError'
  }
}

export function minorUnitsToNzd(minorUnits: number) {
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
    throw new BlinkPayValidationError('minor units')
  }
  return `${Math.floor(minorUnits / 100)}.${String(minorUnits % 100).padStart(2, '0')}`
}

function pcrField(name: keyof BlinkPayPcr, value: string | undefined, required: boolean) {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || !PCR_PATTERN.test(value)) {
    throw new BlinkPayValidationError(`${name} PCR field`)
  }
  return value
}

export function validatePcr(pcr: BlinkPayPcr): BlinkPayPcr {
  return {
    particulars: pcrField('particulars', pcr.particulars, true)!,
    ...(pcr.code === undefined ? {} : { code: pcrField('code', pcr.code, false) }),
    ...(pcr.reference === undefined ? {} : { reference: pcrField('reference', pcr.reference, false) }),
  }
}

export function validatePeriod(period: unknown): BlinkPayPeriod {
  if (typeof period !== 'string' || !(BLINKPAY_PERIODS as readonly string[]).includes(period)) {
    throw new BlinkPayValidationError('period')
  }
  return period as BlinkPayPeriod
}

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function validateIsoTimestamp(value: string) {
  const match = ISO_OFFSET_PATTERN.exec(value)
  if (!match) throw new BlinkPayValidationError('timestamp explicit offset')
  const [, year, month, day, hour, minute, second] = match
  if (!validDateParts(Number(year), Number(month), Number(day)) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || !Number.isFinite(Date.parse(value))) {
    throw new BlinkPayValidationError('timestamp')
  }
  return value
}

export function assertConsentFromTimestamp(value: string, now = new Date()) {
  const timestamp = validateIsoTimestamp(value)
  if (Date.parse(timestamp) > now.getTime()) throw new BlinkPayValidationError('consent from_timestamp cannot be in the future')
  return timestamp
}

export function validateNzDate(value: string) {
  const match = DATE_PATTERN.exec(value)
  if (!match || !validDateParts(Number(match[1]), Number(match[2]), Number(match[3]))) {
    throw new BlinkPayValidationError('NZ start date')
  }
  return value
}

function aucklandParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { date: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')), minute: Number(value('minute')) }
}

export function assertAuthorisedConsent(status: string) {
  if (status !== 'Authorised') throw new BlinkPayValidationError('consent status; expected Authorised')
}

export function assertFixedRecurringPaymentInput(input: {
  consentStatus: string
  period: unknown
  startDate: string
  amountMinor: number
  maximumAmountPaymentMinor: number
  maximumAmountPeriodMinor: number
}, now = new Date()) {
  assertAuthorisedConsent(input.consentStatus)
  const period = validatePeriod(input.period)
  const startDate = validateNzDate(input.startDate)
  minorUnitsToNzd(input.amountMinor)
  minorUnitsToNzd(input.maximumAmountPaymentMinor)
  minorUnitsToNzd(input.maximumAmountPeriodMinor)
  if (input.amountMinor > input.maximumAmountPaymentMinor) throw new BlinkPayValidationError('per-payment limit')
  if (input.amountMinor > input.maximumAmountPeriodMinor) throw new BlinkPayValidationError('period limit')
  const nz = aucklandParts(now)
  if (startDate < nz.date) throw new BlinkPayValidationError('start date is in the past')
  if (period === 'daily' && startDate === nz.date && (nz.hour > 21 || (nz.hour === 21 && nz.minute > 45))) {
    throw new BlinkPayValidationError('daily same-day start after 21:45 Pacific/Auckland')
  }
}

export function assertRedirectUri(value: string, allowedOrigins: readonly string[]) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new BlinkPayValidationError('redirect URI')
  }
  if (url.protocol !== 'https:' || url.username || url.password || !allowedOrigins.includes(url.origin)) {
    throw new BlinkPayValidationError('redirect URI')
  }
  return url.toString()
}

export function assertCallbackUri(value: string, callbackOrigin: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new BlinkPayValidationError('callback URI')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.origin !== callbackOrigin || url.hash) {
    throw new BlinkPayValidationError('callback URI')
  }
  return url.toString()
}
