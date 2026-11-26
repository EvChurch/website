'use client'

import { useCourseAnswer } from './use-course-answer'
import type { CourseAnswerState } from '@/lib/courses/answer-model'
import { budgetTotals, formatBudgetCents, initialBudget, isBudgetAnswer, moneyCents, MAX_BUDGET_ROWS, type BudgetAnswer, type CourseBudget as BudgetBlock } from '@/lib/courses/budget-model'

export function CourseBudget({ block, attemptId, lessonId, initial }: { block: BudgetBlock; attemptId: number; lessonId: string; initial: CourseAnswerState }) {
  const { value, status, conflict, change, useSaved, saveMine, clear } = useCourseAnswer({ attemptId, lessonId, blockId: block.id!, initial })
  const budget = isBudgetAnswer(value) ? value : initialBudget(block)
  const totals = budgetTotals(budget)
  const update = (patch: Partial<BudgetAnswer>) => change({ ...budget, ...patch })
  const updateRow = (id: string, patch: { label?: string; amount?: string }) => update({ rows: budget.rows.map(row => row.id === id ? { ...row, ...patch } : row) })
  const id = `budget-${block.id}`
  const inputClass = 'w-full min-w-0 rounded-lg border border-warm-grey bg-white px-3 py-2 text-brand-black focus:outline-none focus:ring-2 focus:ring-rich-red aria-invalid:border-rich-red'

  return <section className="space-y-6 border-t border-warm-grey pt-6" aria-labelledby={`${id}-title`}>
    <fieldset disabled={initial.readOnly} className="min-w-0 space-y-6">
    <div className="flex items-center justify-between gap-3 text-xs text-mid-grey">
      <span className="rounded-full border border-warm-grey bg-white px-3 py-1">{initial.scope === 'personal' ? 'Personal · Only you' : initial.scope === 'group' ? 'Shared · Everyone in this group' : 'Shared · Your own budget'}</span>
      <span role="status" aria-live="polite">{initial.readOnly ? 'Read only' : status === 'saved' ? '✓ Saved' : status === 'saving' ? 'Saving…' : status === 'conflict' ? 'Updated elsewhere' : 'Couldn’t save'}</span>
    </div>
    <div><h2 id={`${id}-title`} className="text-2xl font-bold">{block.title}{block.required && <span className="ml-2 text-sm font-normal text-mid-grey">Required</span>}</h2>{block.instructions && <p className="mt-3 whitespace-pre-line text-mid-grey">{block.instructions}</p>}</div>
    <div className="max-w-sm"><label htmlFor={`${id}-income`} className="mb-2 block font-bold">Take-home pay per week ($)</label><input id={`${id}-income`} type="text" inputMode="decimal" autoComplete="off" maxLength={20} className={inputClass} value={budget.income} aria-invalid={moneyCents(budget.income) === null} onChange={event => update({ income: event.target.value })} /><p className="mt-2 text-xs text-mid-grey">Weekly amounts in NZ dollars.</p></div>
    <div className="rounded-xl border border-warm-grey bg-white p-5" aria-live="polite">
      <p className="text-sm text-mid-grey">Total planned: {formatBudgetCents(totals.total)}</p>
      <p className="mt-1 text-2xl font-bold text-rich-red">{!totals.valid ? 'Check your amounts' : !budget.income.trim() ? 'Add your take-home pay' : totals.remaining < 0 ? `${formatBudgetCents(-totals.remaining)} over budget` : totals.remaining > 0 ? `${formatBudgetCents(totals.remaining)} left` : 'Budget balanced'}</p>
    </div>
    <div className="space-y-5">{block.categories.map(category => <section key={category.categoryId} className="rounded-xl border border-warm-grey bg-white p-4 sm:p-5" aria-labelledby={`${id}-${category.categoryId}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3"><h3 id={`${id}-${category.categoryId}`} className="text-xl font-bold">{category.label}</h3><span className="shrink-0 text-sm text-mid-grey">{formatBudgetCents(totals.categories[category.categoryId] ?? 0)}</span></div>
      <div className="space-y-3">{budget.rows.filter(row => row.categoryId === category.categoryId).map(row => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_6rem_2rem] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_2rem]">
        <input id={`${id}-${row.id}-name`} aria-invalid={!!row.amount.trim() && !row.label.trim()} aria-label={`${category.label} row name`} className={inputClass} type="text" maxLength={120} value={row.label} onChange={event => updateRow(row.id, { label: event.target.value })} />
        <input aria-label={`${row.label || category.label} per week ($)`} className={`${inputClass} text-right`} type="text" inputMode="decimal" autoComplete="off" maxLength={20} value={row.amount} placeholder="0.00" aria-invalid={moneyCents(row.amount) === null} onChange={event => updateRow(row.id, { amount: event.target.value })} />
        <button type="button" aria-label={`Remove ${row.label || category.label} row`} className="rounded-md text-xl text-mid-grey hover:text-rich-red focus:outline-none focus:ring-2 focus:ring-rich-red" onClick={() => update({ rows: budget.rows.filter(item => item.id !== row.id) })}>×</button>
      </div>)}</div>
      <button type="button" disabled={budget.rows.length >= MAX_BUDGET_ROWS} onClick={() => { const rowId = crypto.randomUUID(); update({ rows: [...budget.rows, { id: rowId, categoryId: category.categoryId, label: '', amount: '' }] }); requestAnimationFrame(() => document.getElementById(`${id}-${rowId}-name`)?.focus()) }} className="mt-4 text-sm font-bold text-rich-red disabled:opacity-50">+ Add a row</button>
    </section>)}</div>
    {status === 'error' && <p role="alert" className="text-sm">Your work is kept here. <button type="button" onClick={saveMine} className="font-bold text-rich-red underline">Retry</button></p>}
    {conflict && <div role="alert" className="rounded-lg border border-warm-grey bg-white p-4 text-sm"><p>Your changes are kept here. Choose which budget to keep.</p><div className="mt-3 flex flex-wrap gap-4"><button type="button" onClick={useSaved} className="font-bold text-rich-red">Use saved budget</button><button type="button" onClick={saveMine} className="font-bold text-rich-red">Save my version</button></div></div>}
    {!initial.readOnly && value !== null && <button type="button" onClick={clear} className="text-xs text-mid-grey underline">Delete budget</button>}
    </fieldset>
  </section>
}
