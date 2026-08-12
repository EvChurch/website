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

import { AnalyticsManager } from './AnalyticsManager'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('AnalyticsManager', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-token')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com')
    navigation.pathname = '/sermons'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllEnvs()
  })

  it('starts anonymous analytics and masked replay on a public route', async () => {
    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        autocapture: false,
        disable_session_recording: false,
        mask_all_text: true,
        person_profiles: 'never',
        session_recording: expect.objectContaining({
          blockSelector: 'form,[data-analytics-sensitive]',
          maskAllInputs: true,
        }),
      }),
    )
    expect(posthog.startExceptionAutocapture).toHaveBeenCalled()
    expect(posthog.startSessionRecording).toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path="/sermons"]')).not.toBeNull()
  })

  it('keeps all analytics off on member routes', async () => {
    navigation.pathname = '/members/connect-groups/123'

    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.startSessionRecording).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path]')).toBeNull()
    expect(
      (window as unknown as Record<string, unknown>)['ga-disable-G-TEST'],
    ).toBe(true)
  })

  it('stops replay before rendering a sensitive route after public tracking', async () => {
    await act(async () => root.render(<AnalyticsManager />))
    posthog.stopSessionRecording.mockClear()
    posthog.stopExceptionAutocapture.mockClear()

    navigation.pathname = '/members/connect-groups/123'
    await act(async () => root.render(<AnalyticsManager />))

    expect(posthog.stopSessionRecording).toHaveBeenCalled()
    expect(posthog.stopExceptionAutocapture).toHaveBeenCalled()
    expect(container.querySelector('[data-ga-path]')).toBeNull()
  })
})
