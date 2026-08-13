// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import { SiteHeader } from './SiteHeader'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  header: vi.fn(({ topOffset }: { topOffset?: number }) => (
    <div data-header-offset={topOffset ?? 0} />
  )),
}))

vi.mock('./Header', () => ({ Header: mocks.header }))

const settings: PublicSiteFeedbackSettings = {
  bannerCopy: 'Help us improve the new ev.church.',
  ctaLabel: 'Share feedback.',
  modalTitle: 'Share your feedback',
  modalIntro: 'Tell us what is working well or what we could improve.',
  dismissalVersion: 'v1',
  turnstileSiteKey: 'site-key',
}

describe('SiteHeader geometry and dismissal', () => {
  let container: HTMLDivElement
  let root: Root
  let resizeCallback: ResizeObserverCallback

  beforeEach(() => {
    localStorage.clear()
    mocks.header.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('uses the measured responsive strip height and removes the offset on dismiss', async () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 44 } as DOMRect)
    await act(async () => root.render(<SiteHeader feedback={settings} />))

    expect(container.querySelector('[data-header-offset="44"]')).not.toBeNull()
    expect(
      container.querySelector<HTMLElement>('[data-site-feedback-spacer]')?.style.height,
    ).toBe('44px')

    const strip = container.querySelector<HTMLElement>('[data-site-feedback-strip]')!
    await act(async () => {
      Object.defineProperty(strip, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ height: 57 }),
      })
      resizeCallback(
        [{ target: strip, contentRect: { height: 41 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      )
    })
    expect(container.querySelector('[data-header-offset="57"]')).not.toBeNull()
    expect(
      container.querySelector<HTMLElement>('[data-site-feedback-spacer]')?.style.height,
    ).toBe('57px')

    await act(async () => {
      Object.defineProperty(strip, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ height: 84 }),
      })
      resizeCallback(
        [{ target: strip, contentRect: { height: 68 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      )
    })
    expect(container.querySelector('[data-header-offset="84"]')).not.toBeNull()
    expect(
      container.querySelector<HTMLElement>('[data-site-feedback-spacer]')?.style.height,
    ).toBe('84px')

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Dismiss feedback prompt"]')!
        .click()
    })
    expect(container.querySelector('[data-site-feedback-strip]')).toBeNull()
    expect(container.querySelector('[data-site-feedback-spacer]')).toBeNull()
    expect(container.querySelector('[data-header-offset="0"]')).not.toBeNull()
    expect(localStorage.getItem('evchurch:site-feedback-dismissed:v1')).toBe('1')
    rect.mockRestore()
  })

  it('suppresses only the stored version and tolerates unavailable storage', async () => {
    localStorage.setItem('evchurch:site-feedback-dismissed:v1', '1')
    await act(async () => root.render(<SiteHeader feedback={settings} />))
    expect(container.querySelector('[data-site-feedback-strip]')).toBeNull()

    await act(async () =>
      root.render(
        <SiteHeader feedback={{ ...settings, dismissalVersion: 'v2' }} />,
      ),
    )
    expect(container.querySelector('[data-site-feedback-strip]')).not.toBeNull()
  })

  it('keeps dismissal usable when localStorage throws', async () => {
    const getItem = vi
      .spyOn(localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable')
      })
    const setItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable')
      })

    await act(async () => root.render(<SiteHeader feedback={settings} />))
    expect(container.querySelector('[data-site-feedback-strip]')).not.toBeNull()

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Dismiss feedback prompt"]')!
        .click()
    })
    expect(container.querySelector('[data-site-feedback-strip]')).toBeNull()
    expect(getItem).toHaveBeenCalled()
    expect(setItem).toHaveBeenCalled()
    getItem.mockRestore()
    setItem.mockRestore()
  })

  it('passes the signed-in member email to feedback', async () => {
    await act(async () =>
      root.render(
        <SiteHeader
          feedback={settings}
          memberProfile={{
            name: 'Aroha Ngata',
            email: 'aroha@example.com',
            avatarUrl: null,
          }}
        />,
      ),
    )
    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[data-feedback-trigger]')!.click(),
    )

    expect(container.querySelector('input[name="email"]')).toBeNull()
  })
})
