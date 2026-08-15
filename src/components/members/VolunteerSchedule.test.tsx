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
  scheduleName: '9am Gathering',
  locationName: 'EV Erina Auditorium',
}

const confirmed = {
  id: 'rock-schedule:22222222-2222-4222-8222-222222222222',
  title: 'Sunday Gatherings — Welcome Team',
  occurrenceStart: '2026-08-30T10:30:00+12:00',
  scheduleName: '10:30am Gathering',
  locationName: null,
}

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
  })

  it('renders requests first, confirmed commitments second, and one generic native handoff', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [confirmed],
          nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
        }}
        isImpersonating={false}
      />,
    ))

    const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
    expect(headings).toEqual(['Requests', 'Upcoming'])
    expect(container.textContent).toContain('Response requested')
    expect(container.textContent).toContain('Confirmed')
    expect(container.textContent).toContain('Sunday Gatherings — Music Team')
    expect(container.textContent).toContain('9am Gathering')
    expect(container.textContent).toContain('EV Erina Auditorium')
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(request.occurrenceStart)
    expect(
      container.querySelector(`[id="rock-schedule:11111111-1111-4111-8111-111111111111"]`)?.getAttribute('tabindex'),
    ).toBe('-1')

    const handoffs = container.querySelectorAll<HTMLAnchorElement>('a[href="https://rock.ev.church/ScheduleToolbox"]')
    expect(handoffs).toHaveLength(1)
    expect(handoffs[0]?.textContent).toContain('Respond in Rock')
    expect(handoffs[0]?.getAttribute('target')).toBe('_blank')
    expect(container.textContent).toContain('accept or decline')
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('button[name*="accept" i], button[name*="decline" i]')).toBeNull()
    expect(handoffs[0]?.href).toBe('https://rock.ev.church/ScheduleToolbox')
    expect(container.innerHTML).not.toContain('attendanceId')
  })

  it('renders confirmed-only and successful empty states without inventing pending work', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [],
          upcoming: [confirmed],
          nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
        }}
        isImpersonating={false}
      />,
    ))
    expect(container.textContent).toContain('You have no serving requests to respond to.')
    expect(container.textContent).toContain('Confirmed')
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()

    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [],
          upcoming: [],
          nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
        }}
        isImpersonating={false}
      />,
    ))
    expect(container.textContent).toContain('You have no upcoming serving requests or commitments.')
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
          nativeToolboxUrl: null,
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

  it('suppresses native response links while impersonating', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [],
          nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
        }}
        isImpersonating
      />,
    ))

    expect(container.textContent).toContain('read-only while impersonating')
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()
  })

  it('refreshes canonical server data on focus or visible return without duplicate immediate calls', async () => {
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [],
          nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
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
    expect(mocks.refresh).toHaveBeenCalledTimes(2)

    await act(async () => vi.advanceTimersByTime(8_000))
    expect(container.textContent).not.toContain('Refreshing your current schedule')
    expect(container.textContent).toContain('could not confirm your latest schedule')
    expect(container.querySelector('a[href*="ScheduleToolbox"]')).toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    expect(mocks.refresh).toHaveBeenCalledTimes(3)
  })

  it('focuses the request identified by a notification fragment', async () => {
    window.history.replaceState(null, '', `/#${request.id}`)
    await act(async () => root.render(
      <VolunteerSchedule
        schedule={{
          status: 'available',
          requests: [request],
          upcoming: [],
          nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
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
      nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
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
      nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
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
