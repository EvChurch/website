// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SiteHeader } from './SiteHeader'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  header: vi.fn(({ topOffset }: { topOffset?: number }) => (
    <div data-header-offset={topOffset ?? 0} />
  )),
}))

vi.mock('./Header', () => ({ Header: mocks.header }))

describe('SiteHeader geometry', () => {
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
    vi.restoreAllMocks()
  })

  it('renders without a feedback bar or header offset', async () => {
    await act(async () => root.render(<SiteHeader />))
    expect(container.querySelector('[data-site-feedback-strip]')).toBeNull()
    expect(container.querySelector('[data-site-feedback-spacer]')).toBeNull()
    expect(container.querySelector('[data-header-offset="0"]')).not.toBeNull()
  })

  it('preserves the persistent impersonation strip', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 48 } as DOMRect)

    await act(async () => root.render(
      <SiteHeader
        impersonation={{ personId: 42, name: 'Alex Member', email: 'alex@example.com' }}
      />,
    ))

    expect(container.querySelector('[data-member-impersonation-strip]')?.textContent)
      .toContain('Impersonating Alex Member')
    expect(container.querySelector('[data-site-feedback-strip]')).toBeNull()
    expect(container.querySelector('[data-feedback-trigger]')).toBeNull()
    expect(container.querySelector('form[action="/member-impersonation/stop"]'))
      .not.toBeNull()
    expect(container.querySelector('[aria-label="Dismiss feedback prompt"]'))
      .toBeNull()
    expect(container.querySelector('[data-header-offset="48"]')).not.toBeNull()
    expect(container.querySelector<HTMLElement>('[data-member-impersonation-spacer]')?.style.height)
      .toBe('48px')
    await act(async () => {
      vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ height: 80 } as DOMRect)
      resizeCallback([], {} as ResizeObserver)
    })
    expect(container.querySelector('[data-header-offset="80"]')).not.toBeNull()

    await act(async () => root.render(<SiteHeader />))
    expect(container.querySelector('[data-member-impersonation-spacer]')).toBeNull()
    expect(container.querySelector('[data-header-offset="0"]')).not.toBeNull()

  })
})
