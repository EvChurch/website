'use client'
import { useEffect, useState } from 'react'
import { readOtherCourseAnswersAction } from '@/app/(frontend)/members/courses/answer-actions'
import type { CourseAnswerValue } from '@/lib/courses/answer-model'
import { budgetTotals, formatBudgetCents, isBudgetAnswer, moneyCents } from '@/lib/courses/budget-model'

export function SharedAnswerValue({ value, choices = [] }: { value: CourseAnswerValue; choices?: Array<{ choiceId: string; label: string }> }) {
  if (isBudgetAnswer(value)) {
    const totals = budgetTotals(value)
    const amount = (input: string) => input.trim() ? formatBudgetCents(moneyCents(input) ?? 0) : '—'
    return <div className="mt-2 text-sm">
      <p>Weekly take-home pay: {amount(value.income)}</p>
      <table className="mt-3 w-full"><caption className="sr-only">Shared weekly budget</caption><tbody>{value.rows.map(row => <tr key={row.id} className="border-b border-warm-grey"><th scope="row" className="py-2 text-left font-normal">{row.label || 'Unnamed row'}</th><td className="py-2 text-right">{amount(row.amount)}</td></tr>)}</tbody></table>
      <p className="mt-3 font-bold">Total planned: {formatBudgetCents(totals.total)}</p>
    </div>
  }
  const label = (key: string) => choices.find(choice => choice.choiceId === key)?.label ?? key
  const text = Array.isArray(value) ? value.map(label).join(', ') : typeof value === 'string' ? label(value) : String(value ?? '')
  return <p className="mt-1 whitespace-pre-line">{text}</p>
}

export function OtherCourseAnswers({ attemptId, lessonId, blockId, choices = [] }: { attemptId: number; lessonId: string; blockId: string; choices?: Array<{ choiceId: string; label: string }> }) {
  const [answers, setAnswers] = useState<Array<{ name: string; value: CourseAnswerValue }>>([])
  useEffect(() => {
    let active = true
    const load = async () => { try { const data = await readOtherCourseAnswersAction(attemptId, lessonId, blockId); if (active) setAnswers(data) } catch { if (active) setAnswers([]) } }
    void load(); const timer = setInterval(load, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [attemptId, lessonId, blockId])
  return <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-rich-red">Other answers ({answers.length})</summary><div className="mt-4 space-y-4">{answers.map((answer, index) => <div key={index} className="border-l-2 border-warm-grey pl-4"><p className="text-sm font-bold">{answer.name}</p><SharedAnswerValue value={answer.value} choices={choices} /></div>)}</div></details>
}
