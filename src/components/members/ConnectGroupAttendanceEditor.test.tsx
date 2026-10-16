// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), push: vi.fn() }))
vi.mock('@/app/(frontend)/members/connect-groups/[rockGroupId]/attendance/actions', () => ({
  loadAttendanceMeetingAction: mocks.load,
  saveAttendanceAction: mocks.save,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))

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

  it('renders accessible explicit marks, totals, notes, and the existing save action', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(2)
    expect(container.querySelector<HTMLImageElement>('img[alt="Aroha\'s profile"]')?.src).toContain('/members/people/1/avatar')
    expect(container.querySelector('[aria-label="James\'s profile"]')?.textContent).toBe('J')
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toContain('Aroha')
    expect(container.textContent).toContain('2 present')
    expect(container.querySelector('textarea')?.labels?.[0]?.textContent).toContain('Meeting notes')
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe('Save')
    expect(container.textContent).not.toContain('Mark remaining Present')
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
  })

  it('leaves unrecorded roster members neutral without writing', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={{ ...selected, marks: { 1: 'present', 2: 'unrecorded' } }} people={people} />))
    const neutralGroup = container.querySelectorAll('[role="radiogroup"]')[1]!
    expect(neutralGroup.querySelector<HTMLInputElement>('input[value="present"]')?.checked).toBe(false)
    expect(neutralGroup.querySelector<HTMLInputElement>('input[value="absent"]')?.checked).toBe(false)
    expect(neutralGroup.querySelector('span[aria-hidden="true"]')).toBeNull()
    expect(container.textContent).toContain('1 present')
    expect(container.textContent).toContain('1 unrecorded')
    expect(container.textContent).not.toContain('Not saved')
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false)
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

  it('confirms named unrecorded people before marking them present and saving', async () => {
    const warningPeople = [
      { rockPersonId: 1, name: 'Aroha', avatarUrl: null },
      { rockPersonId: 2, name: 'James', avatarUrl: null },
      { rockPersonId: 3, name: 'Mia', avatarUrl: null },
      { rockPersonId: 4, name: 'Noah', avatarUrl: null },
      { rockPersonId: 5, name: 'Sophie', avatarUrl: null },
    ]
    const warningMeeting = {
      ...selected,
      marks: { 1: 'present' as const, 2: 'absent' as const, 3: 'unrecorded' as const, 4: 'unrecorded' as const, 5: 'unrecorded' as const },
    }
    mocks.save.mockResolvedValue({ status: 'saved', state: { ...warningMeeting, marks: { 1: 'present', 2: 'absent', 3: 'present', 4: 'present', 5: 'present' } } })
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={warningMeeting} people={warningPeople} />))

    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())
    const dialog = container.querySelector<HTMLDialogElement>('dialog[aria-label="Mark remaining people present?"]')!
    expect(dialog.querySelector('h2')?.textContent).toBe('Mark remaining people present?')
    expect(dialog.querySelector('p')?.textContent).toBe('Mia, Noah and Sophie haven’t been marked.')
    expect(dialog.textContent).not.toContain('If you continue')
    expect(Array.from(dialog.querySelectorAll('button')).map(button => button.textContent)).toEqual(['Cancel', 'Continue'])
    expect(mocks.save).not.toHaveBeenCalled()

    await act(async () => Array.from(dialog.querySelectorAll('button')).find(button => button.textContent === 'Cancel')!.click())
    expect(container.querySelector('dialog[aria-label="Mark remaining people present?"]')).toBeNull()
    expect(mocks.save).not.toHaveBeenCalled()

    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('dialog button')).find(button => button.textContent === 'Continue')!.click())
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][1].edits.marks).toEqual({ 1: 'present', 2: 'absent', 3: 'present', 4: 'present', 5: 'present' })
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/members/connect-groups/10?attendance=saved'))
  })

  it('saves immediately when everyone is already marked', async () => {
    mocks.save.mockResolvedValue({ status: 'saved', state: { ...selected, notes: 'Saved in Rock' } })
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={selected} people={people} />))
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())
    expect(container.querySelector('dialog[aria-label="Mark remaining people present?"]')).toBeNull()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/members/connect-groups/10?attendance=saved'))
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
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Retry')!.click())
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
  })
})
