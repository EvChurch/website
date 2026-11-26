// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CourseQuestion } from './CourseQuestion'
import type { CourseAnswerState } from '@/lib/courses/answer-model'
const { save, read, refresh } = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn(), refresh: vi.fn() }))
vi.mock('@/app/(frontend)/members/courses/answer-actions', () => ({ saveCourseAnswerAction: save, readCourseAnswerAction: read }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement, root: Root
const initial: CourseAnswerState = { blockId: 'q', scope: 'personal', value: 'Original', revision: 1, updatedAt: null }
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks(); container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  read.mockResolvedValue({ ...initial, value: 'Remote', revision: 2 })
  await act(async () => root.render(<CourseQuestion block={{ id: 'q', blockType: 'courseQuestion', prompt: 'Reflection', inputType: 'text', visibility: 'personal' }} attemptId={1} lessonId="l" initial={initial} />))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers() })
async function type(value: string) {
  const textarea = container.querySelector('textarea')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
}
it('preserves typed work on stale save and retries only after explicit choice', async () => {
  save.mockResolvedValue({ status: 'conflict', answer: { ...initial, value: 'Remote', revision: 2 } })
  await type('My work')
  await act(async () => vi.advanceTimersByTimeAsync(600))
  expect(container.querySelector('textarea')!.value).toBe('My work')
  expect(container.textContent).toContain('Your changes are kept here')
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(read).not.toHaveBeenCalled()
  expect(save).toHaveBeenCalledTimes(1)
  save.mockResolvedValue({ status: 'saved', answer: { ...initial, value: 'My work', revision: 3 } })
  await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Save my version')!.click())
  await act(async () => vi.advanceTimersByTimeAsync(600))
  expect(save).toHaveBeenLastCalledWith(1, 'l', 'q', 2, 'My work')
  expect(container.textContent).toContain('✓ Saved')
})
it('retains unsaved text on failure and prevents silent link navigation', async () => {
  save.mockResolvedValue({ status: 'error', message: 'Offline' })
  await type('Keep this')
  await act(async () => vi.advanceTimersByTimeAsync(600))
  expect(container.querySelector('textarea')!.value).toBe('Keep this')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const link = document.createElement('a'); link.href = '/members/courses'; document.body.append(link)
  const click = new MouseEvent('click', { bubbles: true, cancelable: true })
  await act(async () => link.dispatchEvent(click))
  expect(click.defaultPrevented).toBe(true); expect(confirm).toHaveBeenCalled()
  confirm.mockRestore(); link.remove()
})
it('refreshes only clean answers', async () => {
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(container.querySelector('textarea')!.value).toBe('Remote')
  save.mockResolvedValue({ status: 'error', message: 'Offline' })
  await type('Unsent')
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(container.querySelector('textarea')!.value).toBe('Unsent')
  expect(read).toHaveBeenCalledTimes(1)
})

it('asks once before leaving a page with multiple unsaved answers', async () => {
  await act(async () => root.render(<>
    {['q', 'q2'].map(id => <CourseQuestion key={id} block={{ id, blockType: 'courseQuestion', prompt: id, inputType: 'text', visibility: 'personal' }} attemptId={1} lessonId="l" initial={{ ...initial, blockId: id }} />)}
  </>))
  await act(async () => {
    container.querySelectorAll('textarea').forEach(textarea => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Unsaved')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
  })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const link = document.createElement('a'); link.href = '/members/courses'; document.body.append(link)
  const click = new MouseEvent('click', { bubbles: true, cancelable: true })
  await act(async () => link.dispatchEvent(click))
  expect(click.defaultPrevented).toBe(true)
  expect(confirm).toHaveBeenCalledTimes(1)
  confirm.mockRestore(); link.remove()
})

it.each(['personal', 'individual-shared'] as const)('keeps closed %s inputs read-only while allowing owner deletion and retry', async scope => {
  await act(async () => root.render(<CourseQuestion key="closed" block={{ id: 'q', blockType: 'courseQuestion', prompt: 'Reflection', inputType: 'text', visibility: scope === 'personal' ? 'personal' : 'shared' }} attemptId={1} lessonId="l" initial={{ ...initial, scope, readOnly: true }} />))
  expect(container.querySelector('textarea')!.matches(':disabled')).toBe(true)
  const button = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Delete answer')!
  expect(button.matches(':disabled')).toBe(false)
  expect(button.closest('fieldset')).toBeNull()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  save.mockResolvedValue({ status: 'error', message: 'Offline' })
  await act(async () => button.click())
  await act(async () => vi.advanceTimersByTimeAsync(600))
  expect(save).toHaveBeenCalledWith(1, 'l', 'q', 1, null)
  expect(container.textContent).toContain('Couldn’t save')
  const retry = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Retry')!
  expect(retry.matches(':disabled')).toBe(false)
  save.mockResolvedValue({ status: 'saved', answer: { ...initial, value: null, revision: 2 } })
  await act(async () => retry.click())
  await act(async () => vi.advanceTimersByTimeAsync(600))
  expect(save).toHaveBeenCalledTimes(2)
  expect(container.textContent).not.toContain('Couldn’t save')
  expect(container.querySelector('textarea')!.matches(':disabled')).toBe(true)
  confirm.mockRestore()
})

it('does not offer ordinary deletion for a closed group-owned answer', async () => {
  await act(async () => root.render(<CourseQuestion key="closed-group" block={{ id: 'q', blockType: 'courseQuestion', prompt: 'Reflection', inputType: 'text', visibility: 'shared' }} attemptId={1} lessonId="l" initial={{ ...initial, scope: 'group', readOnly: true }} />))
  expect(container.querySelector('textarea')!.matches(':disabled')).toBe(true)
  expect(container.textContent).not.toContain('Delete answer')
})
