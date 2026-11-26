import type { CourseBlock } from './model'

export type CourseBudget = Extract<CourseBlock, { blockType: 'courseBudget' }>
export interface BudgetRow { id: string; categoryId: string; label: string; amount: string }
/** Decimal strings retain ordinary input formatting; all calculations use integer cents. */
export interface BudgetAnswer { kind: 'budget'; income: string; rows: BudgetRow[] }
export const MAX_BUDGET_ROWS = 100
export const MAX_BUDGET_CENTS = 1_000_000_000

export function moneyCents(value: string): number | null {
  const input = value.trim()
  if (!input) return 0
  if (!/^(?:\d{1,8}(?:\.\d{0,2})?|\.\d{1,2})$/.test(input)) return null
  const [whole, fraction = ''] = input.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return cents <= MAX_BUDGET_CENTS ? cents : null
}

export function initialBudget(block: CourseBudget): BudgetAnswer {
  return {
    kind: 'budget', income: '',
    rows: block.categories.flatMap(category => (category.startingLines ?? '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, 10).map((label, index) => ({
      id: `start-${category.categoryId}-${index}`, categoryId: category.categoryId, label, amount: '',
    }))),
  }
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
export function isBudgetAnswer(value: unknown): value is BudgetAnswer {
  return record(value) && value.kind === 'budget' && typeof value.income === 'string' && Array.isArray(value.rows) && value.rows.every(row => record(row) && typeof row.id === 'string' && typeof row.categoryId === 'string' && typeof row.label === 'string' && typeof row.amount === 'string')
}

export function validateBudgetAnswer(block: CourseBudget, input: unknown): BudgetAnswer {
  if (!isBudgetAnswer(input) || input.income.length > 20 || moneyCents(input.income) === null || input.rows.length > MAX_BUDGET_ROWS) throw new Error('Check your budget amounts.')
  const categories = new Set(block.categories.map(category => category.categoryId))
  const ids = new Set<string>()
  for (const row of input.rows) {
    if (!/^[\w-]{1,100}$/.test(row.id) || ids.has(row.id) || !categories.has(row.categoryId) || row.label.length > 120 || row.amount.length > 20 || moneyCents(row.amount) === null || row.amount.trim() && !row.label.trim()) throw new Error('Check your budget rows.')
    ids.add(row.id)
  }
  return { kind: 'budget', income: input.income.trim(), rows: input.rows.map(row => ({ id: row.id, categoryId: row.categoryId, label: row.label.trim(), amount: row.amount.trim() })) }
}

export function budgetTotals(value: BudgetAnswer) {
  const income = moneyCents(value.income)
  const categories = Object.create(null) as Record<string, number>
  let total = 0, valid = income !== null
  for (const row of value.rows) {
    const cents = moneyCents(row.amount)
    if (cents === null) { valid = false; continue }
    total += cents
    categories[row.categoryId] = (categories[row.categoryId] ?? 0) + cents
  }
  return { income: income ?? 0, total, remaining: (income ?? 0) - total, categories, valid }
}

export function budgetComplete(block: CourseBudget, value: BudgetAnswer): boolean {
  try { validateBudgetAnswer(block, value) } catch { return false }
  return value.income.trim() !== '' && value.rows.some(row => row.label.trim() && row.amount.trim())
}

export function formatBudgetCents(cents: number): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 }).format(cents / 100)
}
