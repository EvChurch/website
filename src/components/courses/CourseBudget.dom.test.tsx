// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CourseBudget } from './CourseBudget'
import type { CourseAnswerState } from '@/lib/courses/answer-model'
import { isBudgetAnswer } from '@/lib/courses/budget-model'
const { save, read, refresh } = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn(), refresh: vi.fn() }))
vi.mock('@/app/(frontend)/members/courses/answer-actions', () => ({ saveCourseAnswerAction: save, readCourseAnswerAction: read }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement, root: Root
const initial: CourseAnswerState = { blockId: 'b', scope: 'personal', value: null, revision: 0, updatedAt: null }
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks(); container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  save.mockImplementation(async (_attempt, _lesson, _block, revision, value) => ({ status: 'saved', answer: { ...initial, value, revision: revision + 1 } }))
  await act(async () => root.render(<CourseBudget block={{ id: 'b', blockType: 'courseBudget', title: 'Budget', visibility: 'personal', categories: [{ categoryId: 'live', label: 'Living', startingLines: 'Food' }] }} attemptId={1} lessonId="l" initial={initial} />))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers() })
async function type(input: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
it('calculates totals and saves typed structured data through the shared autosave hook', async () => {
  await type(container.querySelector('input[id$="-income"]')!, '0.30')
  await type(container.querySelector('input[aria-label="Food per week ($)"]')!, '0.10')
  expect(container.textContent).toContain('$0.20 left')
  await act(async () => vi.advanceTimersByTimeAsync(600))
  const value = save.mock.calls[0][4]
  expect(isBudgetAnswer(value) && value.income).toBe('0.30')
  expect(value.rows[0].amount).toBe('0.10')
  expect(container.textContent).toContain('✓ Saved')
})
it('adds and removes stable rows and retains invalid input when saving fails', async () => {
  await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === '+ Add a row')!.click())
  expect(container.querySelectorAll('input[aria-label="Living row name"]')).toHaveLength(2)
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Remove Living row"]')!.click())
  expect(container.querySelectorAll('input[aria-label="Living row name"]')).toHaveLength(1)
  save.mockResolvedValue({ status: 'error', message: 'Invalid amount' })
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Food per week ($)"]')!
  await type(input, '-4')
  await act(async () => vi.advanceTimersByTimeAsync(600))
  expect(input.value).toBe('-4')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(container.textContent).toContain('Couldn’t save')
})
it('disables budget editing when the server marks a shared answer read-only', async () => {
  await act(async () => root.render(<CourseBudget block={{ id: 'b', blockType: 'courseBudget', title: 'Budget', visibility: 'shared', categories: [{ categoryId: 'live', label: 'Living', startingLines: 'Food' }] }} attemptId={1} lessonId="l" initial={{ ...initial, scope: 'group', readOnly: true }} />))
  expect(container.querySelector('fieldset')!.disabled).toBe(true)
  expect(container.querySelector('input')!.matches(':disabled')).toBe(true)
  expect(container.textContent).toContain('Read only')
  expect(container.textContent).not.toContain('Delete budget')
})
