export const GIVING_FREQUENCIES = {
  weekly: { label: 'Weekly', periods: 52 },
  fortnightly: { label: 'Fortnightly', periods: 26 },
  monthly: { label: 'Monthly', periods: 12 },
  yearly: { label: 'Yearly', periods: 1 },
} as const

export type GivingFrequency = keyof typeof GIVING_FREQUENCIES

export interface CalculatorAmount {
  amount: string
  frequency: GivingFrequency
}

export function isValidCalculatorAmount(value: string): boolean {
  const trimmed = value.trim()
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d{0,2})?$/.test(trimmed)
    && Number.isFinite(Number(trimmed.replaceAll(',', '')) * 52)
}

export function parseCalculatorAmount(value: string): number {
  return isValidCalculatorAmount(value) ? Number(value.trim().replaceAll(',', '')) : 0
}

export function annualTotal(rows: CalculatorAmount[]): number {
  return rows.reduce((total, row) => total + parseCalculatorAmount(row.amount) * GIVING_FREQUENCIES[row.frequency].periods, 0)
}

export function givingPercentage(income: number, giving: number): number | null {
  return income > 0 ? giving / income * 100 : null
}

export function annualGivingTarget(income: number, percentage: string): number {
  return income * parseCalculatorAmount(percentage) / 100
}
