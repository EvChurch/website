// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { OtherCourseAnswers } from './OtherCourseAnswers'
const { read } = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/app/(frontend)/members/courses/answer-actions', () => ({ readOtherCourseAnswersAction: read }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it('shows another participant’s structured budget as read-only rows', async () => {
  read.mockResolvedValue([{ name: 'Morgan', value: { kind: 'budget', income: '1000.10', rows: [{ id: 'rent', categoryId: 'live', label: 'Rent', amount: '600.05' }, { id: 'food', categoryId: 'live', label: 'Food', amount: '200.02' }] } }])
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<OtherCourseAnswers attemptId={1} lessonId="lesson" blockId="budget" />))
    expect(container.textContent).toContain('Morgan')
    expect(container.textContent).toContain('$1,000.10')
    expect(container.textContent).toContain('Rent')
    expect(container.textContent).toContain('$800.07')
    expect(container.textContent).not.toContain('[object Object]')
    expect(container.querySelector('input,textarea')).toBeNull()
    expect(read).toHaveBeenCalledWith(1, 'lesson', 'budget')
  } finally { await act(async () => root.unmount()); container.remove() }
})
