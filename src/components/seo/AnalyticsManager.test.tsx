// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ pathname: '/sermons' }))
const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  get_property: vi.fn(),
  init: vi.fn(),
  identify: vi.fn(),
  isFeatureEnabled: vi.fn(),
  onFeatureFlags: vi.fn((_callback: (
    flags: string[],
    variants: Record<string, string | boolean>,
    context: { errorsLoading?: boolean },
  ) => void) => vi.fn()),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
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
  let GivingExperienceProvider: typeof import('../giving/GivingExperienceProvider').GivingExperienceProvider
  let useGivingExperience: typeof import('../giving/GivingExperienceProvider').useGivingExperience
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
    ;({ GivingExperienceProvider, useGivingExperience } = await import('../giving/GivingExperienceProvider'))
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
        disable_surveys: true,
        disable_session_recording: false,
        mask_all_element_attributes: false,
        mask_all_text: false,
        person_profiles: 'identified_only',
        respect_dnt: false,
        session_recording: expect.objectContaining({
          blockSelector: '[data-giving-private]',
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

  it('drops browser-extension rejection noise from exception autocapture', async () => {
    await act(async () => root.render(<AnalyticsManager />))

    const { before_send: beforeSend } = posthog.init.mock.calls[0][1] as {
      before_send: (event: unknown) => unknown
    }
    const noise = {
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value:
              'Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4',
            mechanism: { synthetic: true },
            stacktrace: { frames: [] },
          },
        ],
      },
    }

    expect(beforeSend(noise)).toBeNull()
  })

  it('removes raw exception details before sending a real exception event', async () => {
    await act(async () => root.render(<AnalyticsManager />))

    const { before_send: beforeSend } = posthog.init.mock.calls[0][1] as {
      before_send: (event: unknown) => unknown
    }
    const realError = {
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value: 'Cannot read properties of undefined',
            mechanism: { synthetic: false },
            stacktrace: { frames: [{ filename: 'app.js', lineno: 12 }] },
          },
        ],
      },
    }

    expect(beforeSend(realError)).toEqual({ event: '$exception', properties: {} })
  })

  it('keeps only the allowed signed-in identity properties', async () => {
    await act(async () => root.render(<AnalyticsManager />))

    const { before_send: beforeSend } = posthog.init.mock.calls[0][1] as {
      before_send: (event: unknown) => unknown
    }
    const identity = {
      event: '$identify',
      properties: {
        distinct_id: 'a'.repeat(43),
        $anon_distinct_id: 'anonymous-browser-id',
        $set: {
          email: 'tester@example.com',
          name: 'Test Member',
          amount: '100.00',
          bankReference: 'EV123',
          role: 'admin',
        },
      },
    }

    expect(beforeSend(identity)).toEqual({
      event: '$identify',
      properties: {
        distinct_id: 'a'.repeat(43),
        $anon_distinct_id: 'anonymous-browser-id',
        $set: {
          email: 'tester@example.com',
          name: 'Test Member',
        },
      },
    })
  })

  it('keeps PostHog off when its UI host is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_UI_HOST', '')

    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path="/sermons"]')).not.toBeNull()
  })

  it('subscribes to fresh flag decisions without emitting flag-called events', async () => {
    function FlagStateProbe() {
      return <output data-flag-state>{useGivingExperience().flagState}</output>
    }

    posthog.isFeatureEnabled.mockReturnValue(true)
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production">
        <AnalyticsManager />
        <FlagStateProbe />
      </GivingExperienceProvider>,
    ))

    expect(posthog.onFeatureFlags).toHaveBeenCalledOnce()
    const callback = posthog.onFeatureFlags.mock.calls[0]?.[0]
    await act(async () => callback([], {}, { errorsLoading: false }))

    expect(posthog.isFeatureEnabled).toHaveBeenCalledWith(
      'launcher-giving-pilot',
      { fresh: true, send_event: false },
    )
    expect(container.querySelector('[data-flag-state]')?.textContent).toBe('enabled')

    posthog.isFeatureEnabled.mockReturnValue(undefined)
    await act(async () => callback([], {}, { errorsLoading: false }))
    expect(container.querySelector('[data-flag-state]')?.textContent).toBe('failed')
  })

  it('falls back when PostHog never resolves feature flags', async () => {
    vi.useFakeTimers()
    function FlagStateProbe() {
      return <output data-flag-state>{useGivingExperience().flagState}</output>
    }
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="sandbox">
        <AnalyticsManager />
        <FlagStateProbe />
      </GivingExperienceProvider>,
    ))
    expect(container.querySelector('[data-flag-state]')?.textContent).toBe('unresolved')
    await act(async () => vi.advanceTimersByTimeAsync(3_000))
    expect(container.querySelector('[data-flag-state]')?.textContent).toBe('failed')
    vi.useRealTimers()
  })

  it('identifies signed-in members and resets anonymous browsers', async () => {
    const identity = { distinctId: 'A'.repeat(43), name: 'Aroha Ngata', email: 'aroha@example.com' }
    await act(async () => root.render(<AnalyticsManager postHogIdentity={identity} />))
    expect(posthog.identify).toHaveBeenCalledWith(identity.distinctId, {
      email: identity.email,
      name: identity.name,
    })

    await act(async () => root.render(<AnalyticsManager postHogIdentity={null} />))
    expect(posthog.reset).toHaveBeenCalledOnce()
  })

  it('does not rotate a genuinely anonymous PostHog identity', async () => {
    posthog.get_property.mockReturnValue(undefined)
    await act(async () => root.render(<AnalyticsManager postHogIdentity={null} />))
    expect(posthog.reset).not.toHaveBeenCalled()
  })

  it.each([
    '/members/connect-groups/123',
    '/auth/pending',
    '/contact/pastoral-care',
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

  it.each([
    '/give',
    '/give/return/status',
  ])('does not send giving-private route %s to analytics or replay', async (pathname) => {
    navigation.pathname = pathname

    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(posthog.startSessionRecording).not.toHaveBeenCalled()
    expect(posthog.startExceptionAutocapture).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path]')).toBeNull()
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

  it('stops replay and exception capture while giving is active, then restarts both', async () => {
    function GivingStateControl() {
      const { givingViewActive, setGivingViewActive } = useGivingExperience()
      return (
        <button
          type="button"
          onClick={() => setGivingViewActive(!givingViewActive)}
        >
          toggle giving
        </button>
      )
    }

    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production">
        <AnalyticsManager />
        <GivingStateControl />
      </GivingExperienceProvider>,
    ))
    posthog.startSessionRecording.mockClear()
    posthog.startExceptionAutocapture.mockClear()

    await act(async () => container.querySelector('button')?.click())
    expect(posthog.stopSessionRecording).toHaveBeenCalledOnce()
    expect(posthog.stopExceptionAutocapture).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-ga-path]')).toBeNull()

    await act(async () => container.querySelector('button')?.click())
    expect(posthog.startSessionRecording).toHaveBeenCalledWith(true)
    expect(posthog.startExceptionAutocapture).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-ga-path="/sermons"]')).not.toBeNull()
  })

  it('does not send capability URLs to analytics or replay', async () => {
    navigation.pathname = '/shared/leader-resources/opaque-token'

    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(posthog.startSessionRecording).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path]')).toBeNull()
  })
})
