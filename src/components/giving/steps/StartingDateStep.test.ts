import { describe, expect, it } from 'vitest'

import { clampGivingCustomDate, givingCustomDateLimits, givingDateOptions, givingStartDateSummary, isGivingStartDateValid } from './StartingDateStep'

describe('giving starting dates', () => {
  it('uses Auckland calendar days across daylight-saving changes', () => {
    const options = givingDateOptions('monthly', 1000, new Date('2026-09-26T13:30:00Z'))
    expect(options).toEqual([
      { value: '2026-09-27', label: 'Today' },
      { value: '2026-09-28', label: 'Tomorrow' },
      { value: '2026-10-02', label: 'This Friday' },
      { value: '2026-10-20', label: 'The 20th' },
    ])
  })

  it('uses the current Friday and rolls the 20th into the next month only when needed', () => {
    expect(givingDateOptions('monthly', 1000, new Date('2026-08-16T00:00:00Z')).slice(2)).toEqual([
      { value: '2026-08-21', label: 'This Friday' },
      { value: '2026-08-20', label: 'The 20th' },
    ])
    expect(givingDateOptions('monthly', 1000, new Date('2026-08-21T00:00:00Z')).at(-1)).toEqual(
      { value: '2026-09-20', label: 'The 20th' },
    )
  })

  it('omits Today for daily gifts after the 21:45 Auckland cutoff', () => {
    const now = new Date('2026-08-15T10:00:00Z')
    expect(givingDateOptions('daily', 1000, now).map(({ label }) => label)).not.toContain('Today')
    expect(isGivingStartDateValid('daily', 1000, '2026-08-15', now)).toBe(false)
    expect(isGivingStartDateValid('monthly', 1000, '2026-08-15', now)).toBe(true)
  })

  it('reuses natural shortcut language in the retained starting-date answer', () => {
    const now = new Date('2026-08-16T00:00:00Z')
    expect(givingStartDateSummary('2026-08-16', now)).toBe('today')
    expect(givingStartDateSummary('2026-08-17', now)).toBe('tomorrow')
    expect(givingStartDateSummary('2026-08-21', now)).toBe('this Friday')
    expect(givingStartDateSummary('2026-08-20', now)).toBe('the 20th')
    expect(givingStartDateSummary('2026-08-25', now)).toBe('25 Aug 2026')
  })

  it('offers custom dates from tomorrow through June of the following year', () => {
    expect(givingCustomDateLimits(new Date('2026-08-16T00:00:00Z'))).toEqual({
      min: '2026-08-17',
      max: '2027-06-30',
    })
  })

  it('preserves the chosen day when possible and clamps it to the new month end', () => {
    const now = new Date('2026-08-16T00:00:00Z')
    expect(clampGivingCustomDate('2026-08-31', { month: 9 }, now)).toBe('2026-09-30')
    expect(clampGivingCustomDate('2026-08-31', { year: 2027, month: 2 }, now)).toBe('2027-02-28')
    expect(clampGivingCustomDate('2026-09-30', { month: 10 }, now)).toBe('2026-10-30')
  })
})
