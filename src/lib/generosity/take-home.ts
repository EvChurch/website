import {
  GIVING_FREQUENCIES,
  parseCalculatorAmount,
  type GivingFrequency,
} from './calculator'

export interface TaxSettings {
  hours: number
  bands: { threshold: number; rate: number }[]
  topRate: number
  accRate: number
  accCap: number
  studentRate: number
  studentThreshold: number
  credit: number
  creditMin: number
  creditReduction: number
  creditMax: number
}
// IRD rates for 1 April 2026–31 March 2027. Percentages are stored as percentages.
export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  hours: 40,
  bands: [
    { threshold: 15600, rate: 10.5 },
    { threshold: 53500, rate: 17.5 },
    { threshold: 78100, rate: 30 },
    { threshold: 180000, rate: 33 },
  ],
  topRate: 39,
  accRate: 1.75,
  accCap: 156641,
  studentRate: 12,
  studentThreshold: 24128,
  credit: 520,
  creditMin: 24000,
  creditReduction: 66000,
  creditMax: 70000,
}
export interface Earner {
  id: string
  name: string
  amount: string
  frequency: GivingFrequency | 'hourly'
  incomeBasis?: 'before-tax' | 'after-tax'
  kiwiSaver: boolean
  kiwiRate: number
  employerRate: number
  salarySacrifice: boolean
  studentLoan: boolean
  taxCredit: boolean
}
export function newEarner(id: string): Earner {
  return {
    id,
    name: '',
    amount: '',
    frequency: 'yearly',
    incomeBasis: 'before-tax',
    kiwiSaver: false,
    kiwiRate: 3.5,
    employerRate: 3.5,
    salarySacrifice: false,
    studentLoan: false,
    taxCredit: false,
  }
}
export function validTaxSettings(settings: TaxSettings): boolean {
  const rates = [
    settings.topRate,
    settings.accRate,
    settings.studentRate,
    ...settings.bands.map((b) => b.rate),
  ]
  const amounts = [
    settings.accCap,
    settings.studentThreshold,
    settings.credit,
    settings.creditMin,
    settings.creditReduction,
    settings.creditMax,
  ]
  return (
    settings.hours > 0 &&
    settings.hours <= 168 &&
    rates.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) &&
    amounts.every((n) => Number.isFinite(n) && n >= 0) &&
    settings.bands.length === 4 &&
    settings.bands.every(
      (b, i) =>
        Number.isFinite(b.threshold) &&
        b.threshold > (i ? settings.bands[i - 1].threshold : 0),
    ) &&
    settings.creditMin <= settings.creditReduction &&
    settings.creditReduction < settings.creditMax
  )
}
export function annualSalary(
  earner: Earner,
  settings: TaxSettings,
  creditMonths = 12,
): number {
  const annual =
    parseCalculatorAmount(earner.amount) *
    (earner.frequency === 'hourly'
      ? settings.hours * 52
      : GIVING_FREQUENCIES[earner.frequency].periods)
  if (earner.incomeBasis === 'after-tax') {
    if (annual === 0 || !validTaxSettings(settings)) return 0
    // Invert the same payroll estimate used for before-tax entries, including
    // any selected KiwiSaver, student loan and tax credit settings.
    const netAt = (gross: number) =>
      payroll(gross, earner, settings, creditMonths, (value) => value).net
    let low = 0
    let high = Math.max(annual, 1)
    for (let i = 0; i < 60; i++) {
      if (netAt(high) >= annual) break
      high *= 2
    }
    // Custom deduction rates can make a take-home amount unreachable.
    if (netAt(high) < annual) return Number.NaN
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2
      if (netAt(mid) < annual) low = mid
      else high = mid
    }
    return cents(high)
  }
  return earner.kiwiSaver && earner.salarySacrifice
    ? annual / (1 + earner.employerRate / 100)
    : annual
}
const cents = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100
export function takeHome(
  earner: Earner,
  settings: TaxSettings = DEFAULT_TAX_SETTINGS,
  creditMonths = 12,
) {
  return payroll(
    annualSalary(earner, settings, creditMonths),
    earner,
    settings,
    creditMonths,
  )
}
function payroll(
  gross: number,
  earner: Earner,
  settings: TaxSettings,
  creditMonths: number,
  round: (value: number) => number = cents,
) {
  let tax = 0,
    previous = 0
  for (const band of settings.bands) {
    tax +=
      (Math.max(0, Math.min(gross, band.threshold) - previous) * band.rate) /
      100
    previous = band.threshold
  }
  tax += (Math.max(0, gross - previous) * settings.topRate) / 100
  const credit =
    earner.taxCredit &&
    gross >= settings.creditMin &&
    gross < settings.creditMax
      ? Math.max(
          0,
          settings.credit *
            (Math.max(0, Math.min(12, creditMonths)) / 12) *
            Math.min(
              1,
              (settings.creditMax - gross) /
                (settings.creditMax - settings.creditReduction),
            ),
        )
      : 0
  const paye = round(Math.max(0, tax - credit))
  const acc = round((Math.min(gross, settings.accCap) * settings.accRate) / 100)
  const kiwiSaver = round(
    earner.kiwiSaver ? (gross * earner.kiwiRate) / 100 : 0,
  )
  const studentLoan = round(
    earner.studentLoan
      ? (Math.max(0, gross - settings.studentThreshold) *
          settings.studentRate) /
          100
      : 0,
  )
  return {
    gross: round(gross),
    paye,
    acc,
    kiwiSaver,
    studentLoan,
    credit: round(Math.min(tax, credit)),
    employer: round(earner.kiwiSaver ? (gross * earner.employerRate) / 100 : 0),
    net: round(gross - paye - acc - kiwiSaver - studentLoan),
  }
}
