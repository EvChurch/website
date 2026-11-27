import { isValidCalculatorAmount, parseCalculatorAmount } from './calculator'

export const FAMILY_TAX_YEAR = {
  from: '2026-04-01',
  to: '2027-03-31',
  label: '2026/27',
} as const
export interface FamilyDateRange {
  from: string
  to: string
}
export interface ChildCarePeriod extends FamilyDateRange {
  days: string
  excluded: boolean
}
export interface FamilyChild {
  id: string
  birthDate: string
  educationAfter18: boolean
  care: ChildCarePeriod[]
  parentalLeave: FamilyDateRange[]
}
export interface FamilyCircumstances {
  from: string
  inWork: boolean | null
  eligible: boolean
  couple: boolean | null
  hours: string
  mainBenefit: boolean
  benefitIncome: string
  studentAllowance: boolean
  // Annualised income for this relationship/entitlement period, not cash received in the period.
  familyIncome: string | null
  netIncome: string | null
}
export interface FamilySupport {
  estimate: boolean
  children: string
  childDetails: FamilyChild[]
  eligible: boolean
  periods: FamilyCircumstances[]
}
export interface FamilyIncomeContext {
  gross: number
  afterIncomeTax: number
  hours: number
  salaryGross?: number
  couple?: boolean
}
export interface FamilySupportResult {
  family: number
  inWork: number
  bestStart: number
  minimum: number
  total: number
  creditMonths: number
}
export function newFamilyChild(id: string): FamilyChild {
  return {
    id,
    birthDate: '',
    educationAfter18: false,
    care: [{ ...FAMILY_TAX_YEAR, days: '14', excluded: false }],
    parentalLeave: [],
  }
}
export const DEFAULT_FAMILY_SUPPORT: FamilySupport = {
  estimate: false,
  children: '0',
  childDetails: [],
  eligible: false,
  periods: [
    {
      from: FAMILY_TAX_YEAR.from,
      eligible: true,
      inWork: null,
      couple: null,
      hours: '',
      mainBenefit: false,
      benefitIncome: '',
      studentAllowance: false,
      familyIncome: null,
      netIncome: null,
    },
  ],
}
const DAY = 86400000
export function familyDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp / DAY
    : null
}
const firstDay = familyDate(FAMILY_TAX_YEAR.from)!
const lastDay = familyDate(FAMILY_TAX_YEAR.to)!
function anniversary(birthDate: string, years: number) {
  const [year, month, day] = birthDate.split('-').map(Number)
  // A 29 February birth reaches the relevant age on 1 March in a non-leap year.
  return Date.UTC(year + years, month - 1, day) / DAY
}
function validRanges(ranges: FamilyDateRange[], care = false): boolean {
  const parsed = ranges.map((range) => ({
    from: familyDate(range.from),
    to: familyDate(range.to),
  }))
  if (
    parsed.some(
      (range) =>
        range.from === null || range.to === null || range.from > range.to,
    )
  )
    return false
  const ordered = parsed.sort((a, b) => a.from! - b.from!)
  return (
    !care ||
    ordered.every((range, i) => i === 0 || range.from! > ordered[i - 1].to!)
  )
}
function inRange(day: number, range: FamilyDateRange) {
  return day >= familyDate(range.from)! && day <= familyDate(range.to)!
}
const cents = (value: number) => Math.round((value + 1e-8) * 100) / 100
interface DailyEntitlement {
  day: number
  family: number
  bestStart: number
  workMaximum: number | null
  remainingAbatement: number
  minimumMaximum: number | null
  work: number
  minimum: number
}
// MD 10 / ME 1 use whole qualifying weeks (52 for a full year), while MD 3,
// MD 13 and MG 2–3 use days / 365. Carry continuous qualifying periods across
// changes in circumstances, then apportion their whole-week credit over those days.
function applyWeeklyCredits(
  days: DailyEntitlement[],
  key: 'workMaximum' | 'minimumMaximum',
) {
  let start = 0
  while (start < days.length) {
    if (days[start][key] === null) {
      start++
      continue
    }
    let end = start + 1
    while (end < days.length && days[end][key] !== null) end++
    const length = end - start
    const fraction = Math.min(52, Math.floor(length / 7)) / 52 / length
    for (let i = start; i < end; i++) {
      if (key === 'workMaximum')
        days[i].work =
          fraction > 0
            ? Math.max(
                0,
                days[i].workMaximum! * fraction - days[i].remainingAbatement,
              )
            : 0
      else days[i].minimum = days[i].minimumMaximum! * fraction
    }
    start = end
  }
}
// 2026/27: Income Tax Act MD 2–3, MD 10, MD 13, ME 1–3, MG 1–3.
// https://www.ird.govt.nz/working-for-families/types
// https://www.ird.govt.nz/working-for-families/can-you-get-it/shared-care
export function familySupportResult(
  support: FamilySupport,
  income: FamilyIncomeContext,
): FamilySupportResult | null {
  if (!support.estimate)
    return {
      family: 0,
      inWork: 0,
      bestStart: 0,
      minimum: 0,
      total: 0,
      creditMonths: 12,
    }
  const count = Number(support.children)
  if (
    !support.eligible ||
    !/^\d+$/.test(support.children) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count !== support.childDetails.length ||
    ![income.gross, income.afterIncomeTax, income.hours].every(
      Number.isFinite,
    ) ||
    income.gross < 0 ||
    income.afterIncomeTax < 0
  )
    return null
  const needsBirthDates = support.childDetails.some(
    (child) =>
      child.birthDate !== '' ||
      child.parentalLeave.length > 0 ||
      child.educationAfter18 ||
      child.care.length !== 1 ||
      child.care.some(
        (care) =>
          care.from !== FAMILY_TAX_YEAR.from ||
          care.to !== FAMILY_TAX_YEAR.to ||
          care.days !== '14' ||
          care.excluded,
      ),
  )
  if (
    needsBirthDates &&
    support.childDetails.some((child) => child.birthDate === '')
  )
    return null
  if (
    support.childDetails.some(
      (child) =>
        (child.birthDate !== '' && familyDate(child.birthDate) === null) ||
        !validRanges(child.care, true) ||
        !validRanges(child.parentalLeave) ||
        child.care.some(
          (care) =>
            care.days.trim() === '' ||
            !Number.isFinite(Number(care.days)) ||
            Number(care.days) < 0 ||
            Number(care.days) > 14,
        ),
    )
  )
    return null
  if (
    !support.periods.length ||
    support.periods[0].from !== FAMILY_TAX_YEAR.from
  )
    return null
  const periods = support.periods.map((period) => ({
    ...period,
    inWork: period.inWork ?? (income.salaryGross ?? income.gross) > 0,
    couple: period.couple ?? income.couple ?? false,
    start: familyDate(period.from),
    gross:
      period.familyIncome === null
        ? income.gross
        : parseCalculatorAmount(period.familyIncome),
    net:
      period.netIncome === null
        ? income.afterIncomeTax
        : parseCalculatorAmount(period.netIncome),
    workHours: period.hours === '' ? income.hours : Number(period.hours),
  }))
  if (
    periods.some(
      (period, i) =>
        period.start === null ||
        period.start < firstDay ||
        period.start > lastDay ||
        (i > 0 && period.start <= periods[i - 1].start!) ||
        (period.familyIncome !== null &&
          (period.familyIncome.trim() === '' ||
            !isValidCalculatorAmount(period.familyIncome))) ||
        (period.netIncome !== null &&
          (period.netIncome.trim() === '' ||
            !isValidCalculatorAmount(period.netIncome))) ||
        (period.eligible &&
          period.mainBenefit &&
          (period.benefitIncome.trim() === '' ||
            !isValidCalculatorAmount(period.benefitIncome))) ||
        !Number.isFinite(period.workHours) ||
        period.workHours < 0 ||
        period.workHours > 336 ||
        // A family-income override cannot establish the after-tax amount or its allocation between people.
        (period.eligible &&
          period.inWork &&
          !period.mainBenefit &&
          period.workHours >= (period.couple ? 30 : 20) &&
          period.familyIncome !== null &&
          period.netIncome === null),
    )
  )
    return null
  const children = [...support.childDetails].sort((a, b) =>
    a.birthDate.localeCompare(b.birthDate),
  )
  const protectedFamilyMonths = new Set<number>()
  const protectedBestStartMonths = new Set<number>()
  for (let day = firstDay; day <= lastDay; day++) {
    const period = [...periods]
      .reverse()
      .find((period) => day >= period.start!)!
    if (!period.eligible || !period.mainBenefit) continue
    const month = new Date(day * DAY).getUTCMonth()
    const monthlyAnnualised = parseCalculatorAmount(period.benefitIncome) * 12
    if (monthlyAnnualised < 44900) protectedFamilyMonths.add(month)
    if (monthlyAnnualised < 79000) protectedBestStartMonths.add(month)
  }
  const days: DailyEntitlement[] = []
  let periodIndex = 0
  for (let day = firstDay; day <= lastDay; day++) {
    while (
      periodIndex + 1 < periods.length &&
      day >= periods[periodIndex + 1].start!
    )
      periodIndex++
    const period = periods[periodIndex]
    const active = children.flatMap((child) => {
      const birth = child.birthDate ? familyDate(child.birthDate)! : -Infinity
      const dependencyEnd = !child.birthDate
        ? Infinity
        : child.educationAfter18
          ? Date.UTC(Number(child.birthDate.slice(0, 4)) + 19, 0, 1) / DAY
          : anniversary(child.birthDate, 18)
      const care = child.care.find((range) => inRange(day, range))
      const share = care ? Number(care.days) / 14 : 0
      return period.eligible &&
        day >= birth &&
        day < dependencyEnd &&
        care &&
        share >= 1 / 3
        ? [{ child, care, share }]
        : []
    })
    const familyChildren = active.filter((child) => !child.care.excluded)
    const familyMaximum = familyChildren.reduce(
      (total, child, i) => total + (i === 0 ? 7921 : 6454) * child.share,
      0,
    )
    // Statutory abatement applies to each complete dollar of excess income.
    const month = new Date(day * DAY).getUTCMonth()
    const abatement = protectedFamilyMonths.has(month)
      ? 0
      : Math.floor(Math.max(0, period.gross - 44900)) * 0.275
    const family = Math.max(0, familyMaximum - abatement) / 365
    const bestStart = active.reduce((total, { child, share }) => {
      if (
        !child.birthDate ||
        day >= anniversary(child.birthDate, 3) ||
        child.parentalLeave.some((range) => inRange(day, range))
      )
        return total
      const protectedFirstYear =
        child.birthDate < FAMILY_TAX_YEAR.from &&
        day < anniversary(child.birthDate, 1)
      const reduction =
        protectedFirstYear || protectedBestStartMonths.has(month)
          ? 0
          : Math.floor(Math.max(0, period.gross - 79000)) * 0.21
      return total + Math.max(0, 4041 * share - reduction) / 365
    }, 0)
    const workEligible =
      active.length > 0 &&
      period.inWork &&
      !period.mainBenefit &&
      !period.studentAllowance
    const minimumCare = familyChildren.reduce(
      (best, child) =>
        Math.max(best, child.share > 0.5 ? 1 : child.share === 0.5 ? 0.5 : 0),
      0,
    )
    const minimumEligible =
      minimumCare > 0 &&
      period.inWork &&
      !period.mainBenefit &&
      period.workHours >= (period.couple ? 30 : 20)
    days.push({
      day,
      family,
      bestStart,
      workMaximum: workEligible
        ? 7670 + Math.max(0, active.length - 3) * 780
        : null,
      remainingAbatement: Math.max(0, abatement - familyMaximum) / 365,
      minimumMaximum: minimumEligible
        ? Math.max(0, 36604 - period.net) * minimumCare
        : null,
      work: 0,
      minimum: 0,
    })
  }
  applyWeeklyCredits(days, 'workMaximum')
  applyWeeklyCredits(days, 'minimumMaximum')
  const family = cents(days.reduce((sum, day) => sum + day.family, 0))
  const inWork = cents(days.reduce((sum, day) => sum + day.work, 0))
  const bestStart = cents(days.reduce((sum, day) => sum + day.bestStart, 0))
  const minimum = cents(days.reduce((sum, day) => sum + day.minimum, 0))
  const supportMonths = new Set(
    days
      .filter(
        (day) => day.family + day.bestStart + day.work + day.minimum > 1e-8,
      )
      .map((day) => new Date(day.day * DAY).getUTCMonth()),
  )
  return {
    family,
    inWork,
    bestStart,
    minimum,
    total: cents(family + inWork + bestStart + minimum),
    creditMonths: 12 - supportMonths.size,
  }
}
