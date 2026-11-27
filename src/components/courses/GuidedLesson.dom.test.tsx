// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GuidedLesson, type GuidedStep } from './GuidedLesson'
import { CourseQuestion } from './CourseQuestion'

const { position, save, refresh } = vi.hoisted(() => ({ position: vi.fn(), save: vi.fn(), refresh: vi.fn() }))
vi.mock('@/app/(frontend)/members/courses/progress-actions', () => ({ updateLessonPositionAction: position }))
vi.mock('@/app/(frontend)/members/courses/answer-actions', () => ({ saveCourseAnswerAction: save, readCourseAnswerAction: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement, root: Root
const originalScroll = Element.prototype.scrollIntoView
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  Element.prototype.scrollIntoView = vi.fn()
  position.mockResolvedValue({ status: 'saved' })
  save.mockResolvedValue({ status: 'saved', answer: { blockId: 'q', scope: 'personal', value: 'My reflection', revision: 1, updatedAt: null } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals()
  Element.prototype.scrollIntoView = originalScroll
})
const steps = (): GuidedStep[] => [
  { id: 'reflect', title: 'Reflect', blockIds: ['q'], requiredComplete: true, content: <CourseQuestion block={{ id: 'q', blockType: 'courseQuestion', prompt: 'What stood out?', visibility: 'personal', inputType: 'text' }} attemptId={1} lessonId="l" initial={{ blockId: 'q', scope: 'personal', value: null, revision: 0, updatedAt: null }} /> },
  { id: 'read', title: 'Read', blockIds: [], requiredComplete: true, content: <p>Next reading</p> },
  { id: 'finish', title: 'Pray', blockIds: [], requiredComplete: true, content: <p>Final prayer</p> },
]
async function render(initialStepId = 'reflect', items = steps()) {
  await act(async () => root.render(<GuidedLesson attemptId={1} lessonId="l" steps={items} initialStepId={initialStepId} completion={<button>Finish lesson</button>} />))
}
const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent === text)!

it('shows only the saved current step and persists navigation before moving', async () => {
  await render('read')
  expect(container.querySelector('[role="status"]')?.textContent).toContain('Step 2 of 3')
  expect(container.querySelector('textarea')?.closest('[hidden]')).not.toBeNull()
  expect(button('Finish lesson')).toBeUndefined()
  await act(async () => button('Next →').click())
  expect(position).toHaveBeenCalledWith(1, 'l', 'finish')
  expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('3')
  expect(button('Finish lesson')).toBeDefined()
})

it('keeps drafts mounted and prevents moving away until autosave settles', async () => {
  await render()
  const field = container.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'My reflection')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(button('Next →').disabled).toBe(true)
  await act(async () => vi.advanceTimersByTimeAsync(600))
  expect(button('Next →').disabled).toBe(false)
  await act(async () => button('Next →').click())
  expect(container.querySelector('textarea')).toBe(field)
  expect(field.value).toBe('My reflection')
  await act(async () => button('← Back').click())
  expect(field.closest('[hidden]')).toBeNull()
  expect(field.value).toBe('My reflection')
})

it('retains the current step after a failed position save and permits retry', async () => {
  position.mockResolvedValueOnce({ status: 'error', message: 'Offline' })
  await render()
  await act(async () => button('Next →').click())
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Couldn’t save your place')
  expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1')
  await act(async () => button('Next →').click())
  expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('2')
})

it('waits for required answers without blocking backward review', async () => {
  const items = steps(); items[1].requiredComplete = false
  await render('read', items)
  expect(button('Next →').disabled).toBe(true)
  expect(button('← Back').disabled).toBe(false)
})

it('allows reading a closed workbook even when an unanswered question cannot be edited', async () => {
  const items = steps(); items[1].requiredComplete = false
  await act(async () => root.render(<GuidedLesson attemptId={1} lessonId="l" steps={items} initialStepId="read" readOnly completion={<button disabled>Finish lesson</button>} />))
  expect(button('Next →').disabled).toBe(false)
})
