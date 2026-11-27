import { describe, expect, it } from 'vitest'
import {
  annualSalary,
  DEFAULT_TAX_SETTINGS as settings,
  newEarner,
  takeHome,
  validTaxSettings,
} from './take-home'

const earner = (amount: number) => ({
  ...newEarner('one'),
  amount: String(amount),
})
describe('NZ annual take-home estimates', () => {
  it('uses all five progressive bands', () => {
    for (const [gross, tax] of [
      [0, 0],
      [15600, 1638],
      [53500, 8270.5],
      [78100, 15650.5],
      [180000, 49277.5],
      [200000, 57077.5],
    ]) {
      expect(takeHome(earner(gross)).paye).toBe(tax)
    }
    expect(takeHome(earner(100000))).toMatchObject({
      gross: 100000,
      paye: 22877.5,
      acc: 1750,
      net: 75372.5,
    })
  })
  it('caps ACC and keeps each earner’s tax thresholds separate', () => {
    expect(takeHome(earner(200000)).acc).toBe(2741.22)
    expect(takeHome(earner(100000)).paye * 2).toBeLessThan(
      takeHome(earner(200000)).paye,
    )
  })
  it('deducts KiwiSaver from gross, and student loan only above its threshold', () => {
    const result = takeHome({
      ...earner(100000),
      kiwiSaver: true,
      studentLoan: true,
    })
    expect(result).toMatchObject({
      paye: 22877.5,
      kiwiSaver: 3500,
      employer: 3500,
      studentLoan: 9104.64,
      net: 62767.86,
    })
    expect(takeHome({ ...earner(24128), studentLoan: true }).studentLoan).toBe(
      0,
    )
    expect(takeHome({ ...earner(24129), studentLoan: true }).studentLoan).toBe(
      0.12,
    )
  })
  it('applies IETC only when opted in, with inclusive minimum and linear abatement', () => {
    expect(takeHome(earner(40000)).credit).toBe(0)
    for (const [income, credit] of [
      [23999, 0],
      [24000, 520],
      [66000, 520],
      [68000, 260],
      [70000, 0],
      [71000, 0],
    ]) {
      expect(takeHome({ ...earner(income), taxCredit: true }).credit).toBe(
        credit,
      )
    }
  })
  it('resolves salary packages without deducting employer contribution twice', () => {
    const result = takeHome({
      ...earner(103500),
      kiwiSaver: true,
      salarySacrifice: true,
    })
    expect(result).toMatchObject({
      gross: 100000,
      employer: 3500,
      kiwiSaver: 3500,
      net: 71872.5,
    })
    expect(takeHome({ ...earner(103500), salarySacrifice: true }).gross).toBe(
      103500,
    )
  })
  it('annualises hourly pay and allows custom settings', () => {
    expect(annualSalary({ ...earner(50), frequency: 'hourly' }, settings)).toBe(
      104000,
    )
    expect(
      annualSalary(
        { ...earner(50), frequency: 'hourly' },
        { ...settings, hours: 30 },
      ),
    ).toBe(78000)
    expect(
      takeHome(
        { ...earner(100000), studentLoan: true },
        {
          ...settings,
          studentRate: 10,
          studentThreshold: 20000,
          accRate: 2,
          accCap: 50000,
        },
      ),
    ).toMatchObject({ acc: 1000, studentLoan: 8000 })
  })
  it('grosses up take-home amounts across tax bands and payroll deductions', () => {
    for (const gross of [0, 15600, 24000, 50000, 68000, 100000, 200000]) {
      for (const deductions of [
        {},
        { kiwiSaver: true, studentLoan: true },
        { taxCredit: true },
        { kiwiSaver: true, salarySacrifice: true },
      ]) {
        const before = { ...earner(gross), ...deductions }
        const original = takeHome(before)
        const inferred = takeHome({
          ...before,
          amount: String(original.net),
          incomeBasis: 'after-tax',
        })
        expect(inferred.gross).toBeCloseTo(original.gross, 0)
        expect(inferred.net).toBeCloseTo(original.net, 1)
      }
    }
  })
  it('annualises after-tax pay in every frequency and respects partial tax credits', () => {
    for (const [frequency, periods] of [
      ['hourly', 2080], ['weekly', 52], ['fortnightly', 26], ['monthly', 12], ['yearly', 1],
    ] as const) {
      const result = takeHome({
        ...earner(1000), incomeBasis: 'after-tax', frequency,
      })
      expect(result.net).toBeCloseTo(1000 * periods, 1)
      expect(result.gross).toBeGreaterThan(result.net)
    }
    const original = takeHome({ ...earner(50000), taxCredit: true }, settings, 6)
    const inferred = takeHome({
      ...earner(original.net), incomeBasis: 'after-tax', taxCredit: true,
    }, settings, 6)
    expect(inferred.gross).toBeCloseTo(50000, 1)
  })
  it('does not invent gross income when custom deductions make take-home pay unreachable', () => {
    expect(annualSalary({
      ...earner(1000), incomeBasis: 'after-tax', kiwiSaver: true, kiwiRate: 100,
    }, settings)).toBeNaN()
  })
  it('rejects invalid settings', () => {
    expect(validTaxSettings(settings)).toBe(true)
    expect(validTaxSettings({ ...settings, hours: 0 })).toBe(false)
    expect(validTaxSettings({ ...settings, creditReduction: 70000 })).toBe(
      false,
    )
    expect(
      validTaxSettings({ ...settings, bands: [...settings.bands].reverse() }),
    ).toBe(false)
    expect(validTaxSettings({ ...settings, accRate: 101 })).toBe(false)
  })
})
