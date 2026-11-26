'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readCourseAnswerAction, saveCourseAnswerAction } from '@/app/(frontend)/members/courses/answer-actions'
import type { CourseAnswerState, CourseAnswerValue } from '@/lib/courses/answer-model'

const checkedNavigationEvents = new WeakSet<Event>()

/** Shared autosave behaviour for questions and predefined exercise blocks. */
export function useCourseAnswer({ attemptId, lessonId, blockId, initial }: { attemptId: number; lessonId: string; blockId: string; initial: CourseAnswerState }) {
  const router = useRouter()
  const [value, setValue] = useState<CourseAnswerValue>(initial.value)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error' | 'conflict'>('saved')
  const [conflict, setConflict] = useState<CourseAnswerState | null>(null)
  const [retry, setRetry] = useState(0)
  const revision = useRef(initial.revision)
  const current = useRef(initial.value)
  const dirty = useRef(false)
  const saving = useRef(false)
  const edits = useRef(0)
  const mounted = useRef(true)

  const change = (next: CourseAnswerValue) => {
    current.current = next; dirty.current = true; edits.current++
    setValue(next)
    if (!conflict) setStatus('saving')
  }

  useEffect(() => {
    mounted.current = true
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    const beforeClick = (event: MouseEvent) => {
      if (!dirty.current || checkedNavigationEvents.has(event) || !(event.target instanceof Element) || !event.target.closest('a[href]')) return
      checkedNavigationEvents.add(event)
      if (!window.confirm('Your answer has not saved. Leave this page?')) { event.preventDefault(); event.stopPropagation() }
    }
    const beforeSubmit = (event: Event) => { if (dirty.current) { event.preventDefault(); event.stopPropagation() } }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', beforeClick, true)
    document.addEventListener('submit', beforeSubmit, true)
    return () => { mounted.current = false; window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', beforeClick, true); document.removeEventListener('submit', beforeSubmit, true) }
  }, [])

  useEffect(() => {
    if (!dirty.current || saving.current || conflict || status === 'error') return
    const timer = setTimeout(async () => {
      const sequence = edits.current
      saving.current = true; setStatus('saving')
      try {
        const result = await saveCourseAnswerAction(attemptId, lessonId, blockId, revision.current, current.current)
        if (!mounted.current) return
        if (result.status === 'conflict') { setConflict(result.answer); setStatus('conflict') }
        else if (result.status === 'error') setStatus('error')
        else {
          revision.current = result.answer.revision
          if (sequence === edits.current) { dirty.current = false; setStatus('saved'); router.refresh() }
          else setRetry(count => count + 1)
        }
      } catch { if (mounted.current) setStatus('error') }
      finally { saving.current = false }
    }, 600)
    return () => clearTimeout(timer)
  }, [value, retry, conflict, status, attemptId, lessonId, blockId, router])

  useEffect(() => {
    const timer = setInterval(async () => {
      if (dirty.current || saving.current) return
      try {
        const answer = await readCourseAnswerAction(attemptId, lessonId, blockId)
        if (!mounted.current || dirty.current || saving.current || answer.revision === revision.current) return
        revision.current = answer.revision; current.current = answer.value; setValue(answer.value)
      } catch { /* A failed refresh never replaces local work. */ }
    }, 10000)
    return () => clearInterval(timer)
  }, [attemptId, lessonId, blockId])

  const useSaved = () => {
    if (!conflict) return
    revision.current = conflict.revision; current.current = conflict.value; dirty.current = false; edits.current++
    setValue(conflict.value); setConflict(null); setStatus('saved'); router.refresh()
  }
  const saveMine = () => {
    if (conflict) revision.current = conflict.revision
    setConflict(null); setStatus('saving'); setRetry(count => count + 1)
  }
  const clear = () => { if (window.confirm('Delete this answer?')) change(null) }
  return { value, status, conflict, change, useSaved, saveMine, clear }
}
