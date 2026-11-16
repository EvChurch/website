import { describe, expect, it } from 'vitest'
import { annualGivingTarget, annualTotal, givingPercentage, parseCalculatorAmount } from './calculator'

describe('giving calculator amounts', () => {
  it('combines mixed frequencies without rounding each contribution', () => {
    const giving = annualTotal([
      { amount: '100', frequency: 'weekly' },
      { amount: '50.50', frequency: 'fortnightly' },
      { amount: '200', frequency: 'monthly' },
      { amount: '1,000', frequency: 'yearly' },
    ])
    expect(giving).toBe(9913)
    expect(givingPercentage(100000, giving)).toBeCloseTo(9.913)
  })

  it('does not invent a percentage without income or retain an invalid amount', () => {
    expect(givingPercentage(0, 500)).toBeNull()
    for (const value of ['', '-200', 'not a number', 'Infinity', '100.123']) expect(parseCalculatorAmount(value)).toBe(0)
    expect(annualGivingTarget(104000, '10')).toBe(10400)
    expect(annualGivingTarget(0, '10')).toBe(0)
  })
})
