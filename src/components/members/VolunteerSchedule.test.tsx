// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

import { VolunteerSchedule } from './VolunteerSchedule'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const request = {
  id: 'rock-schedule:11111111-1111-4111-8111-111111111111',
  title: 'Sunday Gatherings — Music Team',
  occurrenceStart: '2026-08-23T09:00:00+12:00',
  scheduleName: 'Sunday 9am Gathering',
  locationName: 'EV Erina Auditorium',
}

const confirmed = {
  id: 'rock-schedule:22222222-2222-4222-8222-222222222222',
  title: 'Sunday Gatherings — Welcome Team',
  occurrenceStart: '2026-08-30T10:30:00+12:00',
  scheduleName: '10:30am Gathering',
  locationName: null,
}

const declined = {
  ...confirmed,
  id: 'rock-schedule:77777777-7777-4777-8777-777777777777',
  title: 'Sunday Gatherings — Prayer Team',
}

const declineReasons = [
  { id: 728, label: 'Family Emergency' },
  { id: 729, label: 'Have to Work' },
]

describe('VolunteerSchedule', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T00:00:00Z'))
    mocks.refresh.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
    vi.restoreAllMocks()
  })

  it('renders requests first with Accept and Decline controls', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [confirmed],
          declined: [],
        }}
        isImpersonating={false}
      />,
    ))

    expect(container.querySelectorAll('article')).toHaveLength(2)
    expect(container.textContent).not.toContain('Requests')
    expect(container.textContent).not.toContain('Upcoming')
    expect(container.querySelector('[aria-label="Response requested"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Response requested"]')?.textContent).toBe('?')
    expect(container.querySelector('[aria-label="Confirmed"]')).not.toBeNull()
    expect(container.textContent).toContain('Sunday Gatherings — Music Team')
    expect(container.textContent).toContain('9am Gathering')
    expect(container.textContent).not.toContain('Sunday 9am Gathering')
    expect(container.textContent).toContain('EV Erina Auditorium')
    expect(container.textContent).not.toContain('Sunday, 23 August 2026')
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(request.occurrenceStart)
    expect(
      container.querySelector(`[id="rock-schedule:11111111-1111-4111-8111-111111111111"]`)?.getAttribute('tabindex'),
    ).toBe('-1')

    expect(container.querySelector('form')).toBeNull()
    expect([...container.querySelectorAll('button')].map(({ textContent }) => textContent))
      .toEqual(expect.arrayContaining(['Accept', 'Decline']))
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()
    expect(container.innerHTML).not.toContain('attendanceId')
  })

  it('keeps a future decline visible and reconfirms it through the member API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'accepted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{ status: 'available', requests: [], upcoming: [], declined: [declined] }}
        isImpersonating={false}
      />,
    ))

    expect(container.querySelector('[aria-label="Declined"]')).not.toBeNull()
    expect(container.textContent).toContain('Sunday Gatherings — Prayer Team')
    expect(container.textContent).not.toContain('Response requested')
    const reconfirm = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Reconfirm')!
    await act(async () => reconfirm.click())

    expect(fetchMock).toHaveBeenCalledWith('/api/member-service/respond', expect.objectContaining({
      body: JSON.stringify({ assignmentId: declined.id, response: 'accept' }),
    }))
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('reconfirmed')
  })

  it('groups mixed role states for the same service into one card', async () => {
    const sameService = {
      ...request,
      id: 'rock-schedule:33333333-3333-4333-8333-333333333333',
      title: 'Sunday Gatherings — Welcome Team',
    }
    const declinedSameService = {
      ...request,
      id: 'rock-schedule:44444444-4444-4444-8444-444444444444',
      title: 'Sunday Gatherings — Prayer Team',
    }
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [sameService],
          declined: [declinedSameService],
        }}
        isImpersonating={false}
      />,
    ))

    expect(container.querySelectorAll('article')).toHaveLength(1)
    expect(container.querySelectorAll('[aria-label="Response requested"]')).toHaveLength(1)
    expect(container.querySelectorAll('[aria-label="Confirmed"]')).toHaveLength(1)
    expect(container.querySelectorAll('[aria-label="Declined"]')).toHaveLength(1)
  })

  it('sorts unanswered services first, then keeps each tier in date order', async () => {
    const laterRequest = {
      ...request,
      occurrenceStart: '2026-09-20T09:00:00+12:00',
    }
    const earlierConfirmed = {
      ...confirmed,
      occurrenceStart: '2026-08-16T10:30:00+12:00',
    }
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [laterRequest],
          upcoming: [earlierConfirmed],
          declined: [],
        }}
        isImpersonating={false}
      />,
    ))

    const cards = [...container.querySelectorAll('article')]
    expect(cards).toHaveLength(2)
    expect(cards[0]?.querySelector('[aria-label="Response requested"]')).not.toBeNull()
    expect(cards[1]?.querySelector('[aria-label="Confirmed"]')).not.toBeNull()
  })

  it('accepts a request through the member API and refreshes schedule and notifications', async () => {
    const notificationRefresh = vi.fn()
    window.addEventListener('member-notifications:refresh', notificationRefresh)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'accepted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available', requests: [request], upcoming: [], declined: [],
        }}
        isImpersonating={false}
      />,
    ))

    const accept = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Accept')!
    await act(async () => accept.click())

    expect(fetchMock).toHaveBeenCalledWith('/api/member-service/respond', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ assignmentId: request.id, response: 'accept' }),
    }))
    expect(container.querySelector(`[id="${request.id}"] [aria-label="Confirmed"]`)).not.toBeNull()
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('accepted')
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(notificationRefresh).toHaveBeenCalledTimes(1)
    window.removeEventListener('member-notifications:refresh', notificationRefresh)
  })

  it('requires a reason before declining through the member API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'declined' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available', requests: [request], upcoming: [], declined: [],
        }}
        declineReasons={declineReasons}
        isImpersonating={false}
      />,
    ))

    const decline = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Decline')!
    await act(async () => decline.click())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Decline this request?')
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true')
    expect(document.documentElement.style.overflow).toBe('hidden')

    const confirm = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent === 'Decline')!
    expect(confirm.disabled).toBe(true)
    const reason = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      reason.value = '729'
      reason.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(confirm.disabled).toBe(false)
    await act(async () => confirm.click())
    expect(fetchMock).toHaveBeenCalledWith('/api/member-service/respond', expect.objectContaining({
      body: JSON.stringify({ assignmentId: request.id, response: 'decline', declineReasonId: 729 }),
    }))
  })

  it('allows a confirmed upcoming commitment to be declined with a reason', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'declined' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{ status: 'available', requests: [], upcoming: [confirmed], declined: [] }}
        declineReasons={declineReasons}
        isImpersonating={false}
      />,
    ))

    const upcomingCard = container.querySelector<HTMLElement>(`[id="${confirmed.id}"]`)!
    await act(async () => [...upcomingCard.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Decline')!.click())
    expect(container.querySelector('[role="dialog"]')?.textContent)
      .toContain('Decline this commitment?')
    expect(fetchMock).not.toHaveBeenCalled()

    const reason = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      reason.value = '728'
      reason.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent === 'Decline')!.click())
    expect(fetchMock).toHaveBeenCalledWith('/api/member-service/respond', expect.objectContaining({
      body: JSON.stringify({ assignmentId: confirmed.id, response: 'decline', declineReasonId: 728 }),
    }))
  })

  it('queues the post-response refresh behind an earlier focus refresh', async () => {
    let resolveResponse!: (value: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => {
      resolveResponse = resolve
    }))
    const schedule = { status: 'available' as const, requests: [request], upcoming: [], declined: [] }
    await act(async () => root.render(
      <VolunteerSchedule schedule={schedule} isImpersonating={false} />,
    ))
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Accept')!.click())
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(mocks.refresh).toHaveBeenCalledTimes(1)

    await act(async () => resolveResponse(new Response(
      JSON.stringify({ status: 'accepted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    expect(mocks.refresh).toHaveBeenCalledTimes(1)

    await act(async () => root.render(
      <VolunteerSchedule schedule={{ ...schedule }} isImpersonating={false} />,
    ))
    expect(container.querySelector(`[id="${request.id}"] [aria-label="Confirmed"]`)).not.toBeNull()
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  it('renders confirmed-only and successful empty states without inventing pending work', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [],
          upcoming: [confirmed],
          declined: [],
        }}
        isImpersonating={false}
      />,
    ))
    expect(container.querySelector('[aria-label="Confirmed"]')).not.toBeNull()
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()

    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [],
          upcoming: [],
          declined: [],
        }}
        isImpersonating={false}
      />,
    ))
    expect(container.textContent).toContain('You have no upcoming serving assignments.')
    expect(container.textContent).not.toContain('temporarily unavailable')
  })

  it('fails closed with a retry when canonical Rock data is unavailable', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'unavailable',
          reason: 'rock-unavailable',
          requests: [],
          upcoming: [],
          declined: [],
        }}
        isImpersonating={false}
      />,
    ))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('temporarily unavailable')
    expect(container.textContent).not.toContain('no upcoming serving requests')
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click()
      container.querySelector<HTMLButtonElement>('button')?.click()
    })
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(container.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true)
  })

  it('suppresses response controls while impersonating', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [],
          declined: [],
        }}
        isImpersonating
      />,
    ))

    expect(container.textContent).toContain('read-only while impersonating')
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()
    expect([...container.querySelectorAll('button')].some((button) => button.textContent === 'Accept')).toBe(false)
    expect([...container.querySelectorAll('button')].some((button) => button.textContent === 'Decline')).toBe(false)
  })

  it('refreshes canonical server data on focus or visible return without duplicate immediate calls', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [],
          declined: [],
        }}
        isImpersonating={false}
      />,
    ))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Refreshing your current schedule')
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(5_000)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(mocks.refresh).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTime(8_000))
    expect(container.textContent).not.toContain('Refreshing your current schedule')
    expect(container.textContent).toContain('could not confirm your latest schedule')
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  it('focuses the request identified by a notification fragment', async () => {
    window.history.replaceState(null, '', `/#${request.id}`)
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [],
          declined: [],
        }}
        isImpersonating={false}
      />,
    ))

    expect(document.activeElement?.id).toBe(request.id)
  })

  it('does not steal focus again after the notification target was handled', async () => {
    window.history.replaceState(null, '', `/#${request.id}`)
    const schedule = {
      status: 'available' as const,
      requests: [request],
      upcoming: [],
      declined: [],
    }
    await act(async () => root.render(
      <VolunteerSchedule schedule={schedule} isImpersonating={false} />,
    ))
    const retry = document.createElement('button')
    document.body.appendChild(retry)
    retry.focus()

    await act(async () => root.render(
      <VolunteerSchedule schedule={{ ...schedule }} isImpersonating={false} />,
    ))

    expect(document.activeElement).toBe(retry)
    retry.remove()
  })

  it('announces when a refreshed request moves to Upcoming or is removed', async () => {
    const pendingSchedule = {
      status: 'available' as const,
      requests: [request],
      upcoming: [],
      declined: [],
    }
    await act(async () => root.render(
      <VolunteerSchedule schedule={pendingSchedule} isImpersonating={false} />,
    ))
    await act(async () => window.dispatchEvent(new Event('focus')))

    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{ ...pendingSchedule, requests: [], upcoming: [request] }}
        isImpersonating={false}
      />,
    ))
    expect(container.querySelector('[aria-live="polite"]')?.textContent)
      .toContain('confirmed and has moved to Upcoming')

    await act(async () => root.render(
      <VolunteerSchedule schedule={pendingSchedule} isImpersonating={false} />,
    ))
    await act(async () => {
      vi.advanceTimersByTime(5_000)
      window.dispatchEvent(new Event('focus'))
    })
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{ ...pendingSchedule, requests: [], upcoming: [] }}
        isImpersonating={false}
      />,
    ))
    expect(container.querySelector('[aria-live="polite"]')?.textContent)
      .toContain('no longer available')
  })
})
