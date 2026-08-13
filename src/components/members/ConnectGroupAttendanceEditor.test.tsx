// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('@/app/(frontend)/members/connect-groups/[rockGroupId]/attendance/actions', () => ({
  loadAttendanceMeetingAction: actions.load,
  saveAttendanceAction: actions.save,
}))

import { ConnectGroupAttendanceEditor } from './ConnectGroupAttendanceEditor'
import type { ConnectGroupAttendanceMeeting } from '@/lib/members/attendance-entry'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const first = { date: '2026-08-12', startDateTime: '2026-08-12T19:00:00+12:00', scheduleId: 1, locationId: null, occurrenceId: null }
const second = { date: '2026-08-05', startDateTime: '2026-08-05T19:00:00+12:00', scheduleId: 1, locationId: null, occurrenceId: 2 }
const people = [{ rockPersonId: 1, name: 'Aroha' }, { rockPersonId: 2, name: 'James' }]
const selected = { identity: first, notes: '', didNotMeet: false, marks: { 1: 'present' as const, 2: 'present' as const } }

describe('ConnectGroupAttendanceEditor', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
    vi.clearAllMocks()
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove() })

  it('renders accessible explicit marks, totals, notes, and immediate save', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(2)
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toContain('Aroha')
    expect(container.textContent).toContain('2 present')
    expect(container.querySelector('textarea')?.labels?.[0]?.textContent).toContain('Meeting notes')
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toContain('Save attendance')
  })

  it('disables marks when the group did not meet', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={selected} people={people} />))
    await act(async () => container.querySelector<HTMLInputElement>('input[name="didNotMeet"]')?.click())
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).every((input) => input.closest('fieldset')?.disabled)).toBe(true)
  })

  it('blocks saving while any existing mark is unrecorded', async () => {
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={{ ...selected, marks: { 1: 'present', 2: 'unrecorded' } }} people={people} />))
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('mark every person')
  })

  it('ignores stale meeting responses and keeps save disabled while loading', async () => {
    let resolveOlder!: (value: ConnectGroupAttendanceMeeting) => void
    actions.load.mockReturnValue(new Promise((resolve) => { resolveOlder = resolve }))
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    await act(async () => { container.querySelector<HTMLSelectElement>('select')!.value = '1'; container.querySelector('select')!.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
    await act(async () => { container.querySelector<HTMLSelectElement>('select')!.value = '0'; container.querySelector('select')!.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => resolveOlder({ ...selected, identity: second, notes: 'stale' }))
    expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).not.toBe('stale')
  })

  it('fails closed when changing meetings cannot load canonical state', async () => {
    actions.load.mockResolvedValue(null)
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first, second]} initialMeeting={selected} people={people} />))
    await act(async () => { container.querySelector<HTMLSelectElement>('select')!.value = '1'; container.querySelector('select')!.dispatchEvent(new Event('change', { bubbles: true })) })
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded'))
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLTextAreaElement>('textarea')?.disabled).toBe(true)
  })

  it('saves immediately once and renders canonical read-back', async () => {
    actions.save.mockResolvedValue({ status: 'saved', state: { ...selected, notes: 'Saved in Rock' } })
    await act(async () => root.render(<ConnectGroupAttendanceEditor rockGroupId={10} meetings={[first]} initialMeeting={selected} people={people} />))
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())
    expect(actions.save).toHaveBeenCalledTimes(1)
    expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Saved in Rock')
    expect(container.textContent).toContain('Attendance saved')
  })
})
