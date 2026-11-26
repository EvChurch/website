import { describe, expect, it } from 'vitest'
import { budgetComplete, budgetTotals, initialBudget, moneyCents, validateBudgetAnswer, type BudgetAnswer, type CourseBudget } from './budget-model'
import { courseAnswerComplete, validateCourseAnswer } from './answer-model'
import { courseStructureKey, type CourseSnapshot } from './model'

const block: CourseBudget = { id: 'budget', blockType: 'courseBudget', title: 'Weekly budget', visibility: 'personal', required: true, categories: [{ categoryId: 'live', label: 'Living', startingLines: 'Rent\nFood' }, { categoryId: 'save', label: 'Savings', startingLines: 'Buffer' }] }
const answer: BudgetAnswer = { kind: 'budget', income: '100.00', rows: [{ id: 'rent', categoryId: 'live', label: 'Rent', amount: '80.10' }, { id: 'food', categoryId: 'live', label: 'Food', amount: '19.90' }] }
const snapshot = (budget: CourseBudget): CourseSnapshot => ({ title: 'Course', slug: 'course', summary: '', allowSolo: true, allowGroup: true, lessons: [{ lessonId: 'one', title: 'Budget', blocks: [budget] }] })

describe('fixed-point budget values', () => {
  it('converts decimal strings exactly and accepts temporary decimal formatting', () => {
    expect(moneyCents('0.10')).toBe(10)
    expect(moneyCents('0.20')).toBe(20)
    expect(moneyCents('.20')).toBe(20)
    expect(moneyCents('1.')).toBe(100)
    expect(moneyCents('')).toBe(0)
    expect(budgetTotals({ ...answer, income: '0.30', rows: [{ ...answer.rows[0], amount: '0.10' }, { ...answer.rows[1], amount: '0.20' }] }).remaining).toBe(0)
  })
  it.each(['-1', '1.001', 'NaN', 'Infinity', '1e3', '1,000', '10000001', '.'])('rejects invalid money %s', input => expect(moneyCents(input)).toBeNull())
  it('supports balanced and over-budget values without making balance a completion gate', () => {
    expect(budgetTotals(answer)).toMatchObject({ total: 10000, remaining: 0, categories: { live: 10000 } })
    const over = { ...answer, income: '99.99' }
    expect(budgetTotals(over).remaining).toBe(-1)
    expect(budgetComplete(block, over)).toBe(true)
    expect(budgetComplete(block, initialBudget(block))).toBe(false)
  })
  it('requires a valid bounded row set with known categories and unique stable IDs', () => {
    expect(validateBudgetAnswer(block, answer)).toEqual(answer)
    expect(() => validateBudgetAnswer(block, { ...answer, rows: [answer.rows[0], answer.rows[0]] })).toThrow()
    expect(() => validateBudgetAnswer(block, { ...answer, rows: [{ ...answer.rows[0], categoryId: 'injected' }] })).toThrow()
    expect(() => validateBudgetAnswer(block, { ...answer, rows: [{ ...answer.rows[0], label: '' }] })).toThrow()
    expect(() => validateBudgetAnswer(block, { ...answer, rows: Array.from({ length: 101 }, (_, i) => ({ ...answer.rows[0], id: String(i) })) })).toThrow()
  })
  it('uses the common answer validation, clearing, and completion contract', () => {
    expect(validateCourseAnswer(block, answer)).toEqual(answer)
    expect(validateCourseAnswer(block, null)).toBeNull()
    expect(() => validateCourseAnswer(block, 'not a budget')).toThrow()
    expect(courseAnswerComplete(block, answer)).toBe(true)
    expect(courseAnswerComplete(block, null)).toBe(false)
  })
  it('creates starter rows without figures and preserves categories', () => {
    expect(initialBudget(block).rows.map(row => [row.categoryId, row.label, row.amount])).toEqual([['live', 'Rent', ''], ['live', 'Food', ''], ['save', 'Buffer', '']])
  })
})

describe('budget edition boundaries', () => {
  it('permits wording corrections but pins sharing, requirements and category structure', () => {
    expect(courseStructureKey(snapshot({ ...block, title: 'Corrected title' }))).toBe(courseStructureKey(snapshot(block)))
    for (const change of [{ visibility: 'shared' as const }, { responseMode: 'individual' as const }, { required: false }, { categories: [{ categoryId: 'different', label: 'Living' }] }, { categories: block.categories.map(category => ({ ...category, label: 'Different category' })) }]) {
      expect(courseStructureKey(snapshot({ ...block, ...change }))).not.toBe(courseStructureKey(snapshot(block)))
    }
  })
})
