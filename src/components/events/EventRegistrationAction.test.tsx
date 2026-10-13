// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ trackAnalyticsEvent: vi.fn() }))

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: mocks.trackAnalyticsEvent,
}))

import {
  EventRegistrationAction,
  OPEN_EVENT_REGISTRATION,
  type OpenEventRegistrationDetail,
} from './EventRegistrationAction'

describe('EventRegistrationAction', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.clearAllMocks()
  })

  it('uses the standard primary button and opens the numeric registration instance', async () => {
    let detail: OpenEventRegistrationDetail | null = null
    const receiveRegistration = (event: Event) => {
      detail = (event as CustomEvent<OpenEventRegistrationDetail>).detail
    }
    window.addEventListener(OPEN_EVENT_REGISTRATION, receiveRegistration)

    await act(async () => {
      root.render(
        <EventRegistrationAction
          campus="unichurch"
          embeddedHref="https://registration.ev.church/?RegistrationInstanceId=81"
          eventSlug="next-steps"
          eventTitle="Next Steps"
          registrationHref="https://registration.ev.church/?RegistrationInstanceId=81"
        />,
      )
    })

    const link = container.querySelector<HTMLAnchorElement>('a')!
    expect(link.className).toContain('rounded-md')
    expect(link.className).toContain('font-semibold')
    expect(link.className).not.toContain('uppercase')

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    })
    await act(async () => link.dispatchEvent(click))

    expect(click.defaultPrevented).toBe(true)
    expect(detail).toEqual({ registrationInstanceId: 81, title: 'Next Steps' })
    expect(mocks.trackAnalyticsEvent).toHaveBeenCalledWith('event_registration_click', {
      event_slug: 'next-steps',
      campus: 'unichurch',
      destination_host: 'registration.ev.church',
    })

    window.removeEventListener(OPEN_EVENT_REGISTRATION, receiveRegistration)
  })
})
