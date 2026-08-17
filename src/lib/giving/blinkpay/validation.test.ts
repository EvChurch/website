import { describe, expect, it } from 'vitest'

import {
  assertAuthorisedConsent,
  assertCallbackUri,
  assertConsentFromTimestamp,
  assertFixedRecurringPaymentInput,
  assertRedirectUri,
  minorUnitsToNzd,
  validateIsoTimestamp,
  validatePcr,
  validatePeriod,
} from './validation'

describe('BlinkPay validation', () => {
  it('formats safe positive minor units as exact two-decimal NZD', () => {
    expect(minorUnitsToNzd(1)).toBe('0.01')
    expect(minorUnitsToNzd(123_456)).toBe('1234.56')
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => minorUnitsToNzd(value)).toThrow(/minor units/i)
    }
  })

  it('accepts only exact BlinkPay periods and valid non-truncated PCR fields', () => {
    for (const period of ['daily', 'weekly', 'fortnightly', 'monthly', 'annual'] as const) {
      expect(validatePeriod(period)).toBe(period)
    }
    expect(() => validatePeriod('twice-monthly')).toThrow(/period/i)
    expect(validatePcr({ particulars: 'EV_123', code: 'GEN&ERAL', reference: 'DONATION#1' })).toEqual({
      particulars: 'EV_123', code: 'GEN&ERAL', reference: 'DONATION#1',
    })
    expect(() => validatePcr({ particulars: '1234567890123', code: 'GENERAL', reference: 'EV1' })).toThrow(/particulars/i)
    expect(() => validatePcr({ particulars: 'EV@123', code: 'GENERAL', reference: 'EV1' })).toThrow(/particulars/i)
  })

  it('requires ISO timestamps with an explicit offset', () => {
    expect(validateIsoTimestamp('2026-09-27T00:00:00+13:00')).toBe('2026-09-27T00:00:00+13:00')
    expect(validateIsoTimestamp('2026-09-26T11:00:00Z')).toBe('2026-09-26T11:00:00Z')
    expect(() => validateIsoTimestamp('2026-09-27T00:00:00')).toThrow(/offset/i)
    expect(() => validateIsoTimestamp('2026-02-30T00:00:00+13:00')).toThrow(/timestamp/i)
    expect(() => assertConsentFromTimestamp('2026-08-15T00:00:01Z', new Date('2026-08-15T00:00:00Z'))).toThrow(/future/i)
  })

  it('uses the Pacific/Auckland calendar across DST and blocks same-day daily starts after 21:45', () => {
    const beforeCutoff = new Date('2026-09-26T08:44:00Z') // 20:44 NZST, day before DST starts
    expect(() => assertFixedRecurringPaymentInput({
      consentStatus: 'Authorised', period: 'daily', startDate: '2026-09-26', amountMinor: 100,
      maximumAmountPaymentMinor: 100, maximumAmountPeriodMinor: 100,
    }, beforeCutoff)).not.toThrow()

    const afterCutoff = new Date('2026-09-26T09:46:00Z') // 21:46 NZST
    expect(() => assertFixedRecurringPaymentInput({
      consentStatus: 'Authorised', period: 'daily', startDate: '2026-09-26', amountMinor: 100,
      maximumAmountPaymentMinor: 100, maximumAmountPeriodMinor: 100,
    }, afterCutoff)).toThrow(/21:45/i)

    const afterDstJump = new Date('2026-09-26T12:30:00Z') // 00:30 NZST on 27 September, before the DST jump
    expect(() => assertFixedRecurringPaymentInput({
      consentStatus: 'Authorised', period: 'monthly', startDate: '2026-09-26', amountMinor: 100,
      maximumAmountPaymentMinor: 100, maximumAmountPeriodMinor: 100,
    }, afterDstJump)).toThrow(/past/i)
  })

  it('requires Authorised consent and enforces per-payment and period limits', () => {
    expect(() => assertAuthorisedConsent('AwaitingAuthorisation')).toThrow(/Authorised/)
    expect(() => assertFixedRecurringPaymentInput({
      consentStatus: 'Authorised', period: 'monthly', startDate: '2026-09-01', amountMinor: 501,
      maximumAmountPaymentMinor: 500, maximumAmountPeriodMinor: 1_000,
    }, new Date('2026-08-15T00:00:00Z'))).toThrow(/per-payment/i)
    expect(() => assertFixedRecurringPaymentInput({
      consentStatus: 'Authorised', period: 'monthly', startDate: '2026-09-01', amountMinor: 501,
      maximumAmountPaymentMinor: 1_000, maximumAmountPeriodMinor: 500,
    }, new Date('2026-08-15T00:00:00Z'))).toThrow(/period/i)
  })

  it('allows only exact environment gateway origins', () => {
    expect(assertRedirectUri('https://sandbox.debit.blinkpay.co.nz/gateway/abc', ['https://sandbox.debit.blinkpay.co.nz'])).toBe('https://sandbox.debit.blinkpay.co.nz/gateway/abc')
    for (const uri of [
      'http://sandbox.debit.blinkpay.co.nz/gateway/abc',
      'https://sandbox.debit.blinkpay.co.nz.evil.test/gateway/abc',
      'https://evil.test/?next=https://sandbox.debit.blinkpay.co.nz',
      'https://sandbox.debit.blinkpay.co.nz@evil.test/gateway/abc',
    ]) expect(() => assertRedirectUri(uri, ['https://sandbox.debit.blinkpay.co.nz'])).toThrow(/redirect/i)
  })

  it('allows an exact HTTP loopback callback only for local development', () => {
    expect(assertCallbackUri('http://localhost:3000/give/return', 'http://localhost:3000')).toBe('http://localhost:3000/give/return')
    expect(() => assertCallbackUri('http://evil.test/give/return', 'http://evil.test')).toThrow(/callback/u)
    expect(() => assertCallbackUri('http://127.0.0.1:3000/give/return', 'http://localhost:3000')).toThrow(/callback/u)
  })
})
