// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

import {
  ScheduleUnavailability,
  UnavailabilitySection,
  UpcomingUnavailability,
} from './ScheduleUnavailability'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

describe('ScheduleUnavailability', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mocks.refresh.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-18T00:00:00Z'))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('submits a date range, notes, and an owned scheduling group', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'saved' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await act(async () => root.render(
      <>
        <ScheduleUnavailability
          groups={[{ id: 701, name: 'Welcome Team' }]}
          isImpersonating={false}
        />
        <UpcomingUnavailability
          isImpersonating={false}
          unavailability={{
          status: 'available',
          exclusions: [{
            id: 'rock-unavailability:one',
            startDate: '2026-08-20',
            endDate: '2026-08-24',
            groupName: 'Welcome Team',
            notes: 'Away',
          }],
          }}
        />
      </>,
    ))

    expect(container.textContent).toContain('Schedule unavailability')
    expect(container.textContent).toContain('Upcoming unavailability')
    expect(container.textContent).toContain('20 Aug 2026 – 24 Aug 2026')
    expect(container.textContent).toContain('Welcome Team')
    expect(container.textContent).toContain('Away')
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Individual')
    expect(container.querySelector<HTMLSelectElement>('#unavailability-group')?.required).toBe(true)

    await act(async () => container.querySelector<HTMLButtonElement>('#unavailability-date-range')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Choose 20 August 2026"]')?.click())
    expect(container.querySelector('[aria-label="Date range calendar"]')).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Choose 22 August 2026"]')?.click())
    expect(container.querySelector('[aria-label="Date range calendar"]')).toBeNull()
    await act(async () => {
      change(container.querySelector('#unavailability-notes')!, 'Away')
      change(container.querySelector('#unavailability-group')!, '701')
    })
    await act(async () => container.querySelector('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    ))

    expect(fetchMock).toHaveBeenCalledWith('/api/member-service/unavailability', expect.objectContaining({
      body: JSON.stringify({
        startDate: '2026-08-20',
        endDate: '2026-08-22',
        notes: 'Away',
        groupId: 701,
      }),
    }))
    expect(container.textContent).toContain('Your unavailability has been saved.')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Your unavailability has been saved.')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('shows the saved message in the upcoming unavailability section', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'saved' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await act(async () => root.render(
      <UnavailabilitySection
        groups={[{ id: 701, name: 'Welcome Team' }]}
        isImpersonating={false}
        unavailability={{ status: 'available', exclusions: [] }}
      />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('#unavailability-date-range')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Choose 20 August 2026"]')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Choose 22 August 2026"]')?.click())
    await act(async () => change(container.querySelector('#unavailability-group')!, '701'))
    await act(async () => container.querySelector('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    ))

    const section = container.querySelector('[aria-labelledby="upcoming-unavailability-heading"]')
    expect(section?.querySelector('[role="status"]')?.textContent)
      .toContain('Your unavailability has been saved.')
  })

  it('uses inline validation and is read-only during impersonation', async () => {
    await act(async () => root.render(
      <>
        <ScheduleUnavailability groups={[{ id: 701, name: 'Welcome Team' }]} isImpersonating={false} />
        <UpcomingUnavailability
          isImpersonating={false}
          unavailability={{ status: 'available', exclusions: [] }}
        />
      </>,
    ))
    const emptyState = [...container.querySelectorAll('p')]
      .find(({ textContent }) => textContent === 'You have no upcoming unavailability.')
    expect(emptyState?.className).toContain('rounded-xl border border-warm-grey bg-white p-4')
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    await act(async () => container.querySelector('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    ))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Choose a current or future')

    await act(async () => root.render(
      <>
        <ScheduleUnavailability groups={[]} isImpersonating />
        <UpcomingUnavailability
          isImpersonating
          unavailability={{ status: 'available', exclusions: [] }}
        />
      </>,
    ))
    expect(container.querySelector('form')).toBeNull()
    expect(container.textContent).toContain('read-only while impersonating')
  })

  it('confirms and removes an upcoming unavailability', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'deleted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    const exclusionId = 'rock-unavailability:33333333-3333-4333-8333-333333333333'
    await act(async () => root.render(
      <UpcomingUnavailability
        isImpersonating={false}
        unavailability={{
          status: 'available',
          exclusions: [{
            id: exclusionId,
            startDate: '2026-08-20',
            endDate: '2026-08-24',
            groupName: 'Welcome Team',
            notes: null,
          }],
        }}
      />,
    ))

    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(({ textContent }) => textContent === 'Remove')?.click())
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.textContent).toContain('Remove unavailability?')
    expect(container.textContent).toContain('20 Aug 2026 – 24 Aug 2026 · Welcome Team')
    expect(fetchMock).not.toHaveBeenCalled()

    const dialogButtons = container.querySelector<HTMLElement>('[role="dialog"]')
      ?.querySelectorAll<HTMLButtonElement>('button')
    dialogButtons?.item(2).focus()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Tab',
    })))
    expect(document.activeElement).toBe(dialogButtons?.item(0))

    await act(async () => container.querySelector<HTMLElement>('[role="dialog"]')
      ?.querySelectorAll<HTMLButtonElement>('button')
      .item(2)
      .click())

    expect(fetchMock).toHaveBeenCalledWith('/api/member-service/unavailability', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ id: exclusionId }),
    }))
    expect(container.textContent).toContain('Your scheduled unavailability has been removed.')
    expect(container.textContent).toContain('You have no upcoming unavailability.')
    expect(mocks.refresh).toHaveBeenCalledOnce()

    await act(async () => root.render(
      <UpcomingUnavailability
        isImpersonating={false}
        notice={{ kind: 'success', text: 'Your unavailability has been saved.' }}
        unavailability={{
          status: 'available',
          exclusions: [{
            id: exclusionId,
            startDate: '2026-08-20',
            endDate: '2026-08-24',
            groupName: 'Welcome Team',
            notes: null,
          }],
        }}
      />,
    ))
    expect(container.textContent).toContain('Your unavailability has been saved.')
    expect(container.textContent).not.toContain('Your scheduled unavailability has been removed.')
  })

  it('shows an indeterminate removal error inside the confirmation dialog', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'outcome-unknown' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ))
    await act(async () => root.render(
      <UpcomingUnavailability
        isImpersonating={false}
        unavailability={{
          status: 'available',
          exclusions: [{
            id: 'rock-unavailability:33333333-3333-4333-8333-333333333333',
            startDate: '2026-08-20',
            endDate: '2026-08-24',
            groupName: 'Welcome Team',
            notes: null,
          }],
        }}
      />,
    ))

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label^="Remove unavailability"]')?.click())
    await act(async () => container.querySelector<HTMLElement>('[role="dialog"]')
      ?.querySelectorAll<HTMLButtonElement>('button')
      .item(2)
      .click())

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.querySelector('[role="alert"]')?.textContent)
      .toContain('We could not confirm whether Rock removed this.')
  })

  it('distinguishes unavailable serving groups from an empty membership list', async () => {
    await act(async () => root.render(
      <ScheduleUnavailability groups={[]} groupsUnavailable isImpersonating={false} />,
    ))

    expect(container.textContent).toContain('Scheduling is temporarily unavailable.')
    expect(container.querySelector('button')).toBeNull()

    await act(async () => root.render(
      <ScheduleUnavailability groups={[]} isImpersonating={false} />,
    ))
    expect(container.textContent).toContain('No serving groups are available.')
  })
})
