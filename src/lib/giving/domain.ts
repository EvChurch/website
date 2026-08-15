import type { ConsentStatus, GivingEnvironment, PaymentStatus, ScheduleStatus } from './contracts'

export function assertPositiveMinorUnits(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Amount must be a positive integer in minor units')
  return value
}

export function assertGivingContext(environment: GivingEnvironment, synthetic: boolean, e2eRunId: number | null): void {
  if (environment === 'production' && (synthetic || e2eRunId !== null)) throw new Error('Production giving records must be real and cannot belong to an E2E run')
  if (environment === 'sandbox' && (!synthetic || e2eRunId === null)) throw new Error('Sandbox giving records must be synthetic and belong to an E2E run')
}

function transition<T extends string>(current: T, next: T, allowed: Readonly<Record<T, readonly T[]>>, terminal: readonly T[]): T {
  if (current === next) return current
  if (terminal.includes(current)) throw new Error(`Cannot regress terminal ${current} state to ${next}`)
  if (!allowed[current].includes(next)) throw new Error(`Cannot regress ${current} state to ${next}`)
  return next
}

const paymentTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['settled', 'failed', 'cancelled'], settled: [], failed: [], cancelled: [],
}
const consentTransitions: Record<ConsentStatus, readonly ConsentStatus[]> = {
  pending: ['authorised', 'failed', 'expired'], authorised: ['revoked', 'expired'], revoked: [], expired: [], failed: [],
}
const scheduleTransitions: Record<ScheduleStatus, readonly ScheduleStatus[]> = {
  pending: ['active', 'unknown', 'cancel_pending', 'failed'], active: ['unknown', 'cancel_pending', 'failed'], unknown: ['active', 'cancel_pending', 'cancelled', 'failed'], cancel_pending: ['cancelled', 'unknown', 'failed'], cancelled: [], failed: [],
}

export const transitionPaymentStatus = (current: PaymentStatus, next: PaymentStatus) => transition(current, next, paymentTransitions, ['settled', 'failed', 'cancelled'])
export const transitionConsentStatus = (current: ConsentStatus, next: ConsentStatus) => transition(current, next, consentTransitions, ['revoked', 'expired', 'failed'])
export const transitionScheduleStatus = (current: ScheduleStatus, next: ScheduleStatus) => transition(current, next, scheduleTransitions, ['cancelled', 'failed'])
