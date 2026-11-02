import { minorUnitsToNzd } from './validation'

export interface BlinkPayPaymentExpectation {
  amountMinor: number
  fundCode: string
  bankCode: string
  bankReference: string
}

/** Compare provider facts with the immutable checkout snapshot, never webhook claims. */
export function assertBlinkPayPaymentDetails(value: unknown, expected: BlinkPayPaymentExpectation) {
  if (!value || typeof value !== 'object') throw new Error('Payment details missing')
  const detail = value as Record<string, unknown>
  const amount = detail.amount as Record<string, unknown> | undefined
  const pcr = detail.pcr as Record<string, unknown> | undefined
  if (amount?.currency !== 'NZD' || amount.total !== minorUnitsToNzd(expected.amountMinor) ||
      pcr?.particulars !== expected.fundCode.slice(0, 12) || pcr.code !== expected.bankCode || pcr.reference !== expected.bankReference) {
    throw new Error('Payment amount or reference mismatch')
  }
}
