// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('@/app/(frontend)/members/connect-groups/[rockGroupId]/attendance/actions', () => ({
  loadAttendanceMeetingAction: mocks.load,
  saveAttendanceAction: mocks.save,
}))

import { ConnectGroupAttendanceEditor } from './ConnectGroupAttendanceEditor'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const first = { date: '2026-08-12', startDateTime: '2026-08-12T19:00:00+12:00', scheduleId: 1, locationId: null, occurrenceId: null }
const second = { date: '2026-08-05', startDateTime: '2026-08-05T19:00:00+12:00', scheduleId: 1, locationId: null, occurrenceId: 2 }
const people = [
  { rockPersonId: 1, name: 'Aroha', avatarUrl: '/members/people/1/avatar' },
  { rockPersonId: 2, name: 'James', avatarUrl: null },
]
const selected = { identity: first, notes: '', didNotMeet: false, marks: { 1: 'present' as const, 2: 'present' as const } }

describe('ConnectGroupAttendanceEditor', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
    vi.resetAllMocks()
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    mocks.save.mockImplementation(async (_group, input) => ({ status: 'saved', state: { ...selected, ...input.edits, marks: input.edits.didNotMeet ? { 1: 'unrecorded', 2: 'unrecorded' } : { ...selected.marks, ...input.edits.marks } } }))
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove() })

  it('renders accessible explicit marks, totals, notes, and autosave status', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(2)
    expect(container.querySelector<HTMLImageElement>('img[alt="Aroha\'s profile"]')?.src).toContain('/members/people/1/avatar')
    expect(container.querySelector('[aria-label="James\'s profile"]')?.textContent).toBe('J')
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toContain('Aroha')
    expect(container.textContent).toContain('2 present')
    expect(container.querySelector('textarea')?.labels?.[0]?.textContent).toContain('Meeting notes')
    expect(container.querySelector('button[type="submit"]')).toBeNull()
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'No changes to save')).toBeTruthy()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark remaining Present')?.disabled).toBe(true)
    expect(container.querySelector('textarea')?.getAttribute('rows')).toBe('3')
  })

  it('slides one black selection between present and absent', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={selected} people={people} />))
    const firstGroup = container.querySelector('[role="radiogroup"]')!
    const slider = firstGroup.querySelector<HTMLSpanElement>('span[aria-hidden="true"]')!
    expect(slider.className).toContain('translate-x-0')
    expect(firstGroup.querySelector<HTMLLabelElement>('label')?.className).toContain('text-white')

    await act(async () => firstGroup.querySelector<HTMLInputElement>('input[value="absent"]')?.click())
    expect(slider.className).toContain('translate-x-full')
    expect(firstGroup.querySelectorAll<HTMLLabelElement>('label')[1]?.className).toContain('text-white')
  })

  it('greys out marks and describes the disabled attendance after cancellation saves', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={selected} people={people} />))
    await act(async () => container.querySelector<HTMLInputElement>('input[name="didNotMeet"]')?.click())
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Clear attendance')?.click())
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).every((input) => input.closest('fieldset')?.disabled && input.closest('fieldset')?.classList.contains('disabled:opacity-50'))).toBe(true)
    expect(container.querySelector('#attendance-summary')?.textContent).toBe('No individual attendance')
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark remaining Present')?.disabled).toBe(true)
  })

  it('leaves unrecorded roster members neutral without warning or writing', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={{ ...selected, marks: { 1: 'present', 2: 'unrecorded' } }} people={people} />))
    const neutralGroup = container.querySelectorAll('[role="radiogroup"]')[1]!
    expect(neutralGroup.querySelector<HTMLInputElement>('input[value="present"]')?.checked).toBe(false)
    expect(neutralGroup.querySelector<HTMLInputElement>('input[value="absent"]')?.checked).toBe(false)
    expect(neutralGroup.querySelector('span[aria-hidden="true"]')).toBeNull()
    expect(container.textContent).toContain('1 present')
    expect(container.textContent).toContain('1 unrecorded')
    expect(container.textContent).not.toContain('Not saved')
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark remaining Present')?.disabled).toBe(false)
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'No changes to save')).toBeTruthy()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('loads another meeting without persisting untouched defaults', async () => {
    mocks.load.mockResolvedValue({ ...selected, identity: second, marks: { 1: 'unrecorded', 2: 'unrecorded' } })
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    await act(async () => { container.querySelector<HTMLSelectElement>('select')!.value = '1'; container.querySelector('select')!.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.textContent).toContain('2 unrecorded')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('fails closed when changing meetings cannot load canonical state', async () => {
    mocks.load.mockResolvedValue(null)
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    await act(async () => { container.querySelector<HTMLSelectElement>('select')!.value = '1'; container.querySelector('select')!.dispatchEvent(new Event('change', { bubbles: true })) })
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded'))
    expect(container.querySelector<HTMLSelectElement>('select')?.value).toBe('0')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('marks only remaining unrecorded people present and reports save progress', async () => {
    let finish!: (result: unknown) => void
    mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const initialMeeting = { ...selected, marks: { 1: 'absent' as const, 2: 'unrecorded' as const } }
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={initialMeeting} people={people} />))

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark remaining Present')!.click())
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][1].edits.marks).toEqual({ 2: 'present' })
    expect(container.querySelector<HTMLInputElement>('input[name="person-1"][value="absent"]')?.checked).toBe(true)
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Saving…')).toBeTruthy()

    await act(async () => finish({ status: 'saved', state: { ...initialMeeting, marks: { 1: 'absent', 2: 'present' } } }))
    await vi.waitFor(() => expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'All changes saved')).toBeTruthy())
    expect(container.querySelector<HTMLInputElement>('input[name="person-2"][value="present"]')?.checked).toBe(true)
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark remaining Present')?.disabled).toBe(true)
  })

  it('shows an accessible rejected-save retry without adding untouched marks', async () => {
    const initialMeeting = { ...selected, marks: { 1: 'present' as const, 2: 'unrecorded' as const } }
    mocks.save.mockResolvedValueOnce({ status: 'rejected', message: 'Try again' })
      .mockResolvedValueOnce({ status: 'saved', state: { ...initialMeeting, marks: { 1: 'present', 2: 'absent' } } })
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={initialMeeting} people={people} />))

    await act(async () => container.querySelector<HTMLInputElement>('input[name="person-2"][value="absent"]')!.click())
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Try again'))
    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Couldn’t save — Retry')!
    expect(retry.className).toContain('underline')
    expect(retry.className).toContain('text-rich-red')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Couldn’t save — Retry')

    await act(async () => retry.click())
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    expect(mocks.save.mock.calls[1][1].edits.marks).toEqual({ 2: 'absent' })
    expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'All changes saved')).toBeTruthy()
  })

  it('checks an uncertain save with the original request and no untouched marks', async () => {
    const initialMeeting = { ...selected, marks: { 1: 'unrecorded' as const, 2: 'unrecorded' as const } }
    mocks.save.mockResolvedValueOnce({ status: 'outcome-unknown', message: 'The save could not be confirmed.' })
      .mockResolvedValueOnce({ status: 'saved', state: { ...initialMeeting, marks: { 1: 'absent', 2: 'unrecorded' } } })
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={initialMeeting} people={people} />))

    await act(async () => container.querySelector<HTMLInputElement>('input[name="person-1"][value="absent"]')!.click())
    await vi.waitFor(() => expect(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Save unconfirmed — Check save status')).toBeTruthy())
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Save unconfirmed — Check save status')!.click())
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))

    expect(mocks.save.mock.calls[1][1].requestId).toBe(mocks.save.mock.calls[0][1].requestId)
    expect(mocks.save.mock.calls[1][1].recoveryOnly).toBe(true)
    expect(mocks.save.mock.calls[1][1].edits.marks).toEqual({ 1: 'absent' })
    expect(container.querySelector<HTMLInputElement>('input[name="person-2"][value="present"]')?.checked).toBe(false)
  })
  it('waits for a pending edit before switching meetings', async () => {
    let finish!: (result: unknown) => void
    mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve }))
    mocks.load.mockResolvedValue({ ...selected, identity: second })
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    await act(async () => container.querySelector<HTMLInputElement>('input[value="absent"]')!.click())
    await act(async () => { container.querySelector<HTMLSelectElement>('select')!.value = '1'; container.querySelector('select')!.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(mocks.load).not.toHaveBeenCalled()
    await act(async () => finish({ status: 'saved', state: { ...selected, marks: { 1: 'absent', 2: 'present' } } }))
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledWith(10, second))
  })

  it('can retry after leaving unsaved edits when the next meeting fails to load', async () => {
    mocks.save.mockResolvedValue({ status: 'rejected', message: 'Try again' })
    mocks.load.mockResolvedValue(null)
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    await act(async () => container.querySelector<HTMLInputElement>('input[value="absent"]')!.click())
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalled())
    await act(async () => { container.querySelector<HTMLSelectElement>('select')!.value = '1'; container.querySelector('select')!.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Leave anyway')!.click())
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalled())
    mocks.save.mockResolvedValue({ status: 'saved', state: selected })
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Couldn’t save — Retry')!.click())
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
  })

})
