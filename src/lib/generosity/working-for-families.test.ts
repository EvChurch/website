import { describe, expect, it } from 'vitest'
import { DEFAULT_TAX_SETTINGS, newEarner, takeHome } from './take-home'
import {
  DEFAULT_FAMILY_SUPPORT,
  FAMILY_TAX_YEAR,
  familyDate,
  familySupportResult,
  newFamilyChild,
  type FamilySupport,
  type FamilyCircumstances,
} from './working-for-families'

function context(gross: number) {
  const salary = takeHome({ ...newEarner('one'), amount: String(gross) })
  return { gross, afterIncomeTax: gross - salary.paye, hours: 40 }
}
function support(
  count: number,
  period: Partial<FamilyCircumstances> = {},
): FamilySupport {
  return {
    ...DEFAULT_FAMILY_SUPPORT,
    estimate: true,
    eligible: true,
    children: String(count),
    childDetails: Array.from({ length: count }, (_, i) => ({
      ...newFamilyChild(String(i)),
      birthDate: '2016-01-01',
    })),
    periods: [
      { ...DEFAULT_FAMILY_SUPPORT.periods[0], inWork: false, ...period },
    ],
  }
}
function childBirth(value: FamilySupport, birthDate: string) {
  return {
    ...value,
    childDetails: value.childDetails.map((child) => ({ ...child, birthDate })),
  }
}
describe('Working for Families 2026/27 entitlement', () => {
  it('matches IRD annual family and in-work examples', () => {
    expect(familySupportResult(support(2), context(37800))).toMatchObject({
      family: 14375,
      inWork: 0,
      bestStart: 0,
      minimum: 0,
      total: 14375,
    })
    expect(
      familySupportResult(support(3, { inWork: true }), context(100000)),
    ).toMatchObject({ family: 5676.5, inWork: 7670, total: 13346.5 })
    expect(
      familySupportResult(support(2, { inWork: true }), context(100000)),
    ).toMatchObject({ family: 0, inWork: 6892.5, total: 6892.5 })
    expect(
      familySupportResult(support(5, { inWork: true }), context(41600))?.inWork,
    ).toBe(9230)
  })
  it('uses complete dollars for abatement and stops at zero', () => {
    expect(familySupportResult(support(1), context(44900.99))?.family).toBe(
      7921,
    )
    expect(familySupportResult(support(1), context(44901))?.family).toBe(
      7920.73,
    )
    expect(
      familySupportResult(support(1, { inWork: true }), context(200000))?.total,
    ).toBe(0)
    expect(
      familySupportResult(support(0, { inWork: true }), context(0))?.total,
    ).toBe(0)
  })
  it('calculates minimum family credit after income tax, excluding ACC, KiwiSaver and student loans', () => {
    // IRD Jeremy example: salary $27,000 - $3,633 tax + $1,000 child support.
    const value = support(2, {
      inWork: true,
      hours: '22',
      familyIncome: '28000',
      netIncome: '24367',
    })
    expect(familySupportResult(value, context(27000))).toMatchObject({
      minimum: 12237,
      family: 14375,
      inWork: 7670,
    })
    const salary = takeHome({
      ...newEarner('one'),
      amount: '27000',
      kiwiSaver: true,
      studentLoan: true,
    })
    expect(salary.net).toBeLessThan(23367)
    expect(
      familySupportResult(
        support(2, { inWork: true, hours: '22' }),
        context(27000),
      )?.minimum,
    ).toBe(13237)
    expect(
      familySupportResult(
        support(2, { inWork: true, hours: '19' }),
        context(27000),
      )?.minimum,
    ).toBe(0)
    expect(
      familySupportResult(
        support(2, { inWork: true, couple: true, hours: '29' }),
        context(27000),
      )?.minimum,
    ).toBe(0)
    expect(
      familySupportResult(
        support(2, { inWork: true, couple: true, hours: '30' }),
        context(27000),
      )?.minimum,
    ).toBe(13237)
  })
  it('applies distinct shared-care rules to all four credits', () => {
    let value = support(2, {
      inWork: true,
      hours: '22',
      familyIncome: '28000',
      netIncome: '24367',
    })
    value.childDetails[1].birthDate = '2024-04-01'
    value.childDetails = value.childDetails.map((child) => ({
      ...child,
      care: [{ ...FAMILY_TAX_YEAR, days: '7', excluded: false }],
    }))
    expect(familySupportResult(value, context(27000))).toMatchObject({
      family: 7187.5,
      inWork: 7670,
      bestStart: 2020.5,
      minimum: 6118.5,
    })
    value.childDetails = value.childDetails.map((child) => ({
      ...child,
      care: [{ ...FAMILY_TAX_YEAR, days: '5', excluded: false }],
    }))
    expect(familySupportResult(value, context(27000))).toMatchObject({
      inWork: 7670,
      minimum: 0,
    })
    value.childDetails = value.childDetails.map((child) => ({
      ...child,
      care: [{ ...FAMILY_TAX_YEAR, days: '4', excluded: false }],
    }))
    expect(familySupportResult(value, context(27000))?.total).toBe(0)
  })
  it('counts unsupported children for in-work credit but excludes family/minimum credits', () => {
    const value = support(1, { inWork: true })
    value.childDetails[0].care[0].excluded = true
    expect(familySupportResult(value, context(27000))).toMatchObject({
      family: 0,
      inWork: 7670,
      minimum: 0,
    })
  })
  it('calculates Best Start per child, with the 2026 birth transition and third birthdays', () => {
    expect(
      familySupportResult(childBirth(support(2), '2024-04-01'), context(83500))
        ?.bestStart,
    ).toBe(6192)
    expect(
      familySupportResult(childBirth(support(1), '2025-10-01'), context(200000))
        ?.bestStart,
    ).toBe(2026.04)
    expect(
      familySupportResult(childBirth(support(1), '2026-10-01'), context(83500))
        ?.bestStart,
    ).toBe(1543.76)
    expect(
      familySupportResult(childBirth(support(1), '2023-10-01'), context(50000))
        ?.bestStart,
    ).toBe(2026.04)
  })
  it('excludes paid parental leave and starts Best Start on the following day', () => {
    const value = childBirth(support(1), '2026-06-01')
    value.childDetails[0].parentalLeave = [
      { from: '2026-04-16', to: '2026-10-14' },
    ]
    expect(familySupportResult(value, context(83500))?.bestStart).toBe(1425.01)
  })
  it('handles dated care changes without double-counting and assigns the eldest rate each day', () => {
    const value = support(2)
    value.childDetails[0].birthDate = '2010-01-01'
    value.childDetails[0].care[0].to = '2026-09-30'
    // 183 days with two children, 182 with one. Child 2 receives the eldest rate after child 1 leaves.
    expect(familySupportResult(value, context(30000))?.family).toBe(11156.84)
    value.childDetails[1].care = [
      {
        from: FAMILY_TAX_YEAR.from,
        to: '2026-09-30',
        days: '14',
        excluded: false,
      },
      {
        from: '2026-10-01',
        to: FAMILY_TAX_YEAR.to,
        days: '7',
        excluded: false,
      },
    ]
    expect(familySupportResult(value, context(30000))?.family).toBe(9182.02)
  })
  it('ends dependent-child eligibility at 18 unless education continues, then by 31 December', () => {
    const value = childBirth(support(1), '2008-06-01')
    expect(familySupportResult(value, context(20000))?.family).toBe(1323.78)
    value.childDetails[0].educationAfter18 = true
    expect(familySupportResult(value, context(20000))?.family).toBe(5967.88)
  })
  it('uses dated benefit and work changes, whole qualifying weeks and no in-work credit on student allowance', () => {
    const value = support(2, {
      inWork: false,
      mainBenefit: true,
      benefitIncome: '2500',
    })
    value.periods.push({
      ...value.periods[0],
      from: '2026-10-01',
      inWork: true,
      mainBenefit: false,
    })
    expect(familySupportResult(value, context(30000))?.inWork).toBe(3835)
    expect(familySupportResult(value, context(30000))?.minimum).toBe(5381)
    expect(
      familySupportResult(
        support(2, { inWork: true, studentAllowance: true }),
        context(30000),
      ),
    ).toMatchObject({ inWork: 0, minimum: 10762 })
    const short = support(1, { inWork: false })
    short.periods.push({
      ...short.periods[0],
      from: '2027-03-26',
      inWork: true,
    })
    expect(familySupportResult(short, context(30000))?.inWork).toBe(0)
  })
  it('protects benefit months using monthly income instead of the higher annual income', () => {
    const value = support(2, { mainBenefit: true, benefitIncome: '1000' })
    value.periods.push({
      ...value.periods[0],
      from: '2026-10-01',
      mainBenefit: false,
      inWork: true,
    })
    expect(familySupportResult(value, context(100000))).toMatchObject({
      family: 7207.19,
      inWork: 3447.32,
    })
    const missing = support(1, { mainBenefit: true })
    expect(familySupportResult(missing, context(100000))).toBeNull()
  })

  it('tracks IETC by whole months when a baby arrives part-way through the year', () => {
    const result = familySupportResult(
      childBirth(support(1), '2027-01-01'),
      context(50000),
    )!
    expect(result).toMatchObject({
      creditMonths: 9,
      family: 1607.3,
      bestStart: 996.41,
      total: 2603.71,
    })
    expect(
      takeHome(
        { ...newEarner('one'), amount: '50000', taxCredit: true },
        DEFAULT_TAX_SETTINGS,
        result.creditMonths,
      ).credit,
    ).toBe(390)
  })
  it('requires complete valid details and net income for income overrides', () => {
    expect(
      familySupportResult({ ...support(1), eligible: false }, context(50000)),
    ).toBeNull()
    expect(
      familySupportResult({ ...support(1), children: '1.5' }, context(50000)),
    ).toBeNull()
    expect(
      familySupportResult(childBirth(support(1), '2026-02-30'), context(50000)),
    ).toBeNull()
    const value = support(1)
    value.childDetails[0].care.push({
      ...FAMILY_TAX_YEAR,
      days: '7',
      excluded: false,
    })
    expect(familySupportResult(value, context(50000))).toBeNull()
    expect(
      familySupportResult(
        support(1, { inWork: true, familyIncome: '60000' }),
        context(50000),
      ),
    ).toBeNull()
    expect(familyDate('not-a-date')).toBeNull()
    const unordered = support(1)
    unordered.periods.push({ ...unordered.periods[0], from: '2026-03-01' })
    expect(familySupportResult(unordered, context(50000))).toBeNull()
  })
  it('adds no support while the Working for Families checkbox is off', () => {
    expect(
      familySupportResult(DEFAULT_FAMILY_SUPPORT, context(50000)),
    ).toMatchObject({ total: 0, creditMonths: 12 })
  })
  it('uses the existing income and count for the default full-year care scenario', () => {
    const value = support(2, { inWork: null, couple: null })
    value.childDetails = value.childDetails.map((child) => ({
      ...child,
      birthDate: '',
    }))
    expect(familySupportResult(value, context(50000))).toMatchObject({
      family: 12972.5,
      inWork: 7670,
      bestStart: 0,
      total: 20642.5,
    })
  })
})
