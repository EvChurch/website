// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ pathname: '/sermons' }))
const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  startExceptionAutocapture: vi.fn(),
  startSessionRecording: vi.fn(),
  stopExceptionAutocapture: vi.fn(),
  stopSessionRecording: vi.fn(),
}))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('posthog-js', () => ({ default: posthog }))
vi.mock('./GoogleAnalytics', () => ({
  GA_ID: 'G-TEST',
  GoogleAnalytics: ({ pagePath }: { pagePath: string }) => (
    <div data-ga-path={pagePath} />
  ),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('AnalyticsManager', () => {
  let AnalyticsManager: typeof import('./AnalyticsManager').AnalyticsManager
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-token')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://t.ev.church')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_UI_HOST', 'https://us.posthog.com')
    navigation.pathname = '/sermons'
    ;({ AnalyticsManager } = await import('./AnalyticsManager'))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllEnvs()
  })

  it('records replay content while masking values entered into form controls', async () => {
    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        api_host: 'https://t.ev.church',
        autocapture: false,
        disable_session_recording: false,
        mask_all_element_attributes: false,
        mask_all_text: false,
        person_profiles: 'never',
        respect_dnt: false,
        session_recording: expect.objectContaining({
          blockSelector: ':not(*)',
          maskAllInputs: true,
          maskAllElementAttributes: false,
          maskTextSelector: ':not(*)',
        }),
        ui_host: 'https://us.posthog.com',
      }),
    )
    expect(posthog.startExceptionAutocapture).toHaveBeenCalled()
    expect(posthog.startSessionRecording).toHaveBeenCalledWith(true)
    expect(container.querySelector('[data-ga-path="/sermons"]')).not.toBeNull()
  })

  it('keeps PostHog off when its UI host is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_UI_HOST', '')

    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path="/sermons"]')).not.toBeNull()
  })

  it.each([
    '/members/connect-groups/123',
    '/auth/pending',
    '/contact/pastoral-care',
    '/give',
    '/member-sign-in/error',
    '/privacy',
  ])('records PostHog replay on excluded Google Analytics route %s', async (pathname) => {
    navigation.pathname = pathname

    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        disable_session_recording: false,
        session_recording: expect.objectContaining({ maskAllInputs: true }),
      }),
    )
    expect(posthog.startExceptionAutocapture).toHaveBeenCalled()
    expect(posthog.capture).toHaveBeenCalledWith('$pageview', {
      $current_url: `http://localhost:3000${pathname}`,
      $pathname: pathname,
    })
    expect(posthog.startSessionRecording).toHaveBeenCalledWith(true)
    expect(container.querySelector('[data-ga-path]')).toBeNull()
    expect(
      (window as unknown as Record<string, unknown>)['ga-disable-G-TEST'],
    ).toBe(true)
  })

  it('continues replay when navigating from a public route to a member route', async () => {
    await act(async () => root.render(<AnalyticsManager />))
    posthog.startSessionRecording.mockClear()
    posthog.startExceptionAutocapture.mockClear()
    posthog.stopSessionRecording.mockClear()
    posthog.stopExceptionAutocapture.mockClear()

    navigation.pathname = '/members/connect-groups/123'
    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.startSessionRecording).not.toHaveBeenCalled()
    expect(posthog.startExceptionAutocapture).not.toHaveBeenCalled()
    expect(posthog.stopSessionRecording).not.toHaveBeenCalled()
    expect(posthog.stopExceptionAutocapture).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path]')).toBeNull()
  })
})
