// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ContextualCtaAnchor, TrackedAnchor } from './TrackedLink'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('TrackedAnchor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    window.history.replaceState({}, '', '/events/example')
    window.gtag = vi.fn()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    window.history.replaceState({}, '', '/')
    delete window.gtag
    vi.restoreAllMocks()
  })

  it('tracks one event and preserves the original click handler', async () => {
    const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
    })

    await act(async () => root.render(
      <TrackedAnchor
        href="https://rock.ev.church/registration/example"
        eventName="event_registration_click"
        eventParameters={{
          event_slug: 'example',
          campus: 'north',
          destination_host: 'rock.ev.church',
        }}
        onClick={onClick}
      >
        Register
      </TrackedAnchor>,
    ))

    await act(async () => container.querySelector('a')?.click())

    expect(window.gtag).toHaveBeenCalledTimes(1)
    expect(window.gtag).toHaveBeenCalledWith('event', 'event_registration_click', {
      event_slug: 'example',
      campus: 'north',
      destination_host: 'rock.ev.church',
    })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      '/connect-groups',
      '/contact',
      '/contact?topic=connect-groups',
      'connect_group_enquiry_click',
      { destination_path: '/contact' },
    ],
    [
      '/kids',
      '/visit',
      '/visit?source=kids',
      'ministry_enquiry_click',
      { ministry: 'kids', destination_path: '/visit' },
    ],
    [
      '/youth',
      '/contact',
      '/contact?topic=youth',
      'ministry_enquiry_click',
      { ministry: 'youth', destination_path: '/contact' },
    ],
  ])('tracks the contextual CTA on %s', async (pathname, href, expectedHref, eventName, parameters) => {
    window.history.replaceState({}, '', pathname)

    await act(async () => root.render(
      <ContextualCtaAnchor href={href} onClick={(event) => event.preventDefault()}>
        Continue
      </ContextualCtaAnchor>,
    ))

    await act(async () => container.querySelector('a')?.click())

    expect(container.querySelector('a')?.getAttribute('href')).toBe(expectedHref)
    expect(window.gtag).toHaveBeenCalledWith('event', eventName, parameters)
  })
})
