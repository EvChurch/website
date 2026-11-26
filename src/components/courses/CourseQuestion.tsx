'use client'

import { useCourseAnswer } from './use-course-answer'
import type { CourseQuestion as Question, CourseAnswerState } from '@/lib/courses/answer-model'

export function CourseQuestion({ block, attemptId, lessonId, initial }: { block: Question; attemptId: number; lessonId: string; initial: CourseAnswerState }) {
  const blockId = block.id!
  const fieldId = `question-${blockId}`
  const { value, status, conflict, change, useSaved, saveMine, clear } = useCourseAnswer({ attemptId, lessonId, blockId, initial })
  const classes = 'w-full rounded-lg border border-warm-grey bg-white px-4 py-3 text-brand-black focus:outline-none focus:ring-2 focus:ring-rich-red'
  const choices = block.choices ?? []

  return <section className="border-t border-warm-grey pt-6" aria-labelledby={`${fieldId}-label`}>
    <div className="mb-3 flex items-center justify-between gap-3 text-xs text-mid-grey">
      <span className="rounded-full border border-warm-grey bg-white px-3 py-1">{initial.scope === 'personal' ? 'Personal · Only you' : initial.scope === 'group' ? 'Shared · Everyone in this group' : 'Shared · Your own answer'}</span>
      <span role="status" aria-live="polite">{status === 'saved' ? '✓ Saved' : status === 'saving' ? 'Saving…' : status === 'conflict' ? 'Updated elsewhere' : 'Couldn’t save'}</span>
    </div>
    <fieldset disabled={initial.readOnly} className="min-w-0 border-0 p-0">
    <label id={`${fieldId}-label`} htmlFor={fieldId} className="mb-4 block text-xl font-bold">{block.prompt}{block.required && <span className="ml-2 text-sm font-normal text-mid-grey">Required</span>}</label>
    {block.inputType === 'text' && <textarea id={fieldId} className={classes} rows={4} maxLength={10000} value={typeof value === 'string' ? value : ''} onChange={event => change(event.target.value)} />}
    {block.inputType === 'number' && <input id={fieldId} className={classes} type="number" step="any" value={typeof value === 'number' ? value : ''} onChange={event => change(event.target.value === '' ? null : Number(event.target.value))} />}
    {block.inputType === 'choice' && <select id={fieldId} className={classes} value={typeof value === 'string' ? value : ''} onChange={event => change(event.target.value)}><option value="">Choose an answer</option>{choices.map(choice => <option key={choice.choiceId} value={choice.choiceId}>{choice.label}</option>)}</select>}
    {block.inputType === 'checklist' && <div id={fieldId} role="group" aria-labelledby={`${fieldId}-label`} className="space-y-3">{choices.map(choice => <label key={choice.choiceId} className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-5 accent-rich-red" checked={Array.isArray(value) && value.includes(choice.choiceId)} onChange={event => { const selected = Array.isArray(value) ? value : []; change(event.target.checked ? [...selected, choice.choiceId] : selected.filter(item => item !== choice.choiceId)) }} /><span>{choice.label}</span></label>)}</div>}
    {block.guidance && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-rich-red">A way in</summary><p className="mt-3 whitespace-pre-line text-mid-grey">{block.guidance}</p></details>}
    {status === 'error' && <p role="alert" className="mt-3 text-sm">Your answer is kept here. <button type="button" onClick={saveMine} className="font-bold text-rich-red underline">Retry</button></p>}
    {conflict && <div role="alert" className="mt-4 rounded-lg border border-warm-grey bg-white p-4 text-sm"><p>Your changes are kept here. Choose which answer to keep.</p><div className="mt-3 flex flex-wrap gap-4"><button type="button" onClick={useSaved} className="font-bold text-rich-red">Use saved answer</button><button type="button" onClick={saveMine} className="font-bold text-rich-red">Save my version</button></div></div>}
    {value !== null && value !== '' && <button type="button" onClick={clear} className="mt-4 text-xs text-mid-grey underline">Delete answer</button>}
    </fieldset>
  </section>
}
