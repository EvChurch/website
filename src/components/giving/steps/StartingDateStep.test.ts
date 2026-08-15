import { describe, expect, it } from 'vitest'

import { givingDateOptions, isGivingStartDateValid } from './StartingDateStep'

describe('giving starting dates', () => {
  it('uses Auckland calendar days across daylight-saving changes', () => {
    const options = givingDateOptions('monthly', 1000, new Date('2026-09-26T13:30:00Z'))
    expect(options.map(({ value }) => value)).toEqual(['2026-09-27', '2026-09-28', '2026-10-04', '2026-10-11'])
  })

  it('omits Today for daily gifts after the 21:45 Auckland cutoff', () => {
    const now = new Date('2026-08-15T10:00:00Z')
    expect(givingDateOptions('daily', 1000, now).map(({ label }) => label)).not.toContain('Today')
    expect(isGivingStartDateValid('daily', 1000, '2026-08-15', now)).toBe(false)
    expect(isGivingStartDateValid('monthly', 1000, '2026-08-15', now)).toBe(true)
  })
})
