'use client'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { updateLessonPositionAction } from '@/app/(frontend)/members/courses/progress-actions'
import { LessonAnswerActivity, type AnswerActivity } from './LessonAnswerActivity'

export interface GuidedStep {
  id: string
  title: string
  content: ReactNode
  blockIds: string[]
  requiredComplete: boolean
}

export function GuidedLesson({ attemptId, lessonId, steps, initialStepId, completion, readOnly = false }: {
  attemptId: number; lessonId: string; steps: GuidedStep[]; initialStepId: string; completion: ReactNode; readOnly?: boolean
}) {
  const [stepId, setStepId] = useState(initialStepId)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState(false)
  const [answers, setAnswers] = useState<Record<string, AnswerActivity>>({})
  const section = useRef<HTMLElement>(null)
  const report = useCallback((blockId: string, status: AnswerActivity | null) => setAnswers(previous => {
    if (previous[blockId] === status || (!status && !(blockId in previous))) return previous
    const next = { ...previous }
    if (status) next[blockId] = status
    else delete next[blockId]
    return next
  }), [])
  const activity = useMemo(() => ({ report }), [report])
  const index = Math.max(0, steps.findIndex(step => step.id === stepId))
  const step = steps[index]
  const unsettled = !readOnly && step.blockIds.some(id => answers[id] && answers[id] !== 'saved')
  const incomplete = !readOnly && !step.requiredComplete
  const anyUnsettled = Object.values(answers).some(status => status !== 'saved')

  async function move(nextIndex: number) {
    if (moving || unsettled || nextIndex < 0 || nextIndex >= steps.length) return
    setMoving(true); setError(false)
    try {
      const result = await updateLessonPositionAction(attemptId, lessonId, steps[nextIndex].id)
      if (result.status !== 'saved') { setError(true); return }
      setStepId(steps[nextIndex].id)
      requestAnimationFrame(() => {
        section.current?.focus({ preventScroll: true })
        section.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      })
    } catch { setError(true) }
    finally { setMoving(false) }
  }

  return <LessonAnswerActivity.Provider value={activity}>
    <section ref={section} tabIndex={-1} aria-label="Lesson walkthrough" className="scroll-mt-28 outline-none">
      <div className="mb-8 space-y-3">
        <p role="status" className="text-sm font-bold text-mid-grey">Step {index + 1} of {steps.length} · {step.title}</p>
        <div role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} className="h-1.5 overflow-hidden rounded-full bg-warm-grey"><div className="h-full bg-rich-red transition-all" style={{ width: `${(index + 1) / steps.length * 100}%` }} /></div>
      </div>
      {/* Keep drafts mounted while moving between steps so autosave cannot lose work. */}
      {steps.map((item, itemIndex) => <div key={item.id} hidden={itemIndex !== index}>{item.content}</div>)}
      <div className="mt-8 border-t border-warm-grey pt-5">
        {error && <p role="alert" className="mb-4 text-sm text-rich-red">Couldn’t save your place. Try again.</p>}
        {unsettled && <p className="mb-4 text-sm text-mid-grey">{step.blockIds.some(id => answers[id] === 'error' || answers[id] === 'conflict') ? 'Resolve the answer above to continue.' : 'Saving your answer…'}</p>}
        {!unsettled && incomplete && <p className="mb-4 text-sm text-mid-grey">Complete the required question before continuing.</p>}
        <div className="flex items-center justify-between gap-4">
          <button type="button" disabled={index === 0 || moving || unsettled} onClick={() => void move(index - 1)} className="rounded-md border border-warm-grey px-5 py-3 text-sm font-bold disabled:opacity-40">← Back</button>
          {index < steps.length - 1 ? <button type="button" disabled={moving || unsettled || incomplete} onClick={() => void move(index + 1)} className="rounded-md bg-rich-red px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{moving ? 'Saving…' : 'Next →'}</button> : <fieldset disabled={moving || anyUnsettled} className="min-w-0">{completion}</fieldset>}
        </div>
      </div>
    </section>
  </LessonAnswerActivity.Provider>
}
