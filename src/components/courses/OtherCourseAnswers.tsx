'use client'
import { useEffect, useState } from 'react'
import { readOtherCourseAnswersAction } from '@/app/(frontend)/members/courses/answer-actions'
import type { CourseAnswerValue } from '@/lib/courses/answer-model'

export function OtherCourseAnswers({ attemptId, lessonId, blockId, choices = [] }: { attemptId: number; lessonId: string; blockId: string; choices?: Array<{ choiceId: string; label: string }> }) {
  const [answers, setAnswers] = useState<Array<{ name: string; value: CourseAnswerValue }>>([])
  useEffect(() => {
    let active = true
    const load = async () => { try { const data = await readOtherCourseAnswersAction(attemptId, lessonId, blockId); if (active) setAnswers(data) } catch { if (active) setAnswers([]) } }
    void load(); const timer = setInterval(load, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [attemptId, lessonId, blockId])
  const display = (value: CourseAnswerValue) => { const label = (key: string) => choices.find(choice => choice.choiceId === key)?.label ?? key; return Array.isArray(value) ? value.map(label).join(', ') : typeof value === 'string' ? label(value) : String(value ?? '') }
  return <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-rich-red">Other answers ({answers.length})</summary><div className="mt-4 space-y-4">{answers.map((answer, index) => <div key={index} className="border-l-2 border-warm-grey pl-4"><p className="text-sm font-bold">{answer.name}</p><p className="mt-1 whitespace-pre-line">{display(answer.value)}</p></div>)}</div></details>
}
