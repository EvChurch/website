'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import posthog, { type CaptureResult } from 'posthog-js'

import {
  canTrackAnalyticsPath,
  mustPauseAnalyticsCapture,
} from '@/lib/analytics-privacy'
import { useGivingExperience } from '@/components/giving/GivingExperienceProvider'
import {
  GIVING_FLAG_KEY,
  sanitizeAnalyticsPayload,
} from '@/lib/giving/analytics'
import { GA_ID, GoogleAnalytics } from './GoogleAnalytics'

let postHogInitialized = false
let privateCaptureActive = false

// A browser extension (the known source is an Outlook/Office family one) injects
// a script that rejects a promise with a plain string. Exception autocapture
// reports this as a synthetic non-Error rejection with no stack frames.
const BROWSER_EXTENSION_REJECTION =
  /Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+/

interface ExceptionListEntry {
  value?: unknown
  mechanism?: { synthetic?: boolean }
  stacktrace?: { frames?: unknown[] }
}

function isBrowserExtensionRejection(entry: ExceptionListEntry): boolean {
  if (
    typeof entry.value === 'string' &&
    BROWSER_EXTENSION_REJECTION.test(entry.value)
  ) {
    return true
  }
  const hasNoFrames = (entry.stacktrace?.frames?.length ?? 0) === 0
  return entry.mechanism?.synthetic === true && hasNoFrames
}

// Drop a $exception event when every entry is browser-extension noise, so error
// tracking does not open and reopen issues that look like production errors.
function dropBrowserExtensionExceptions(
  event: CaptureResult | null,
): CaptureResult | null {
  if (event?.event !== '$exception') return event
  const entries = event.properties.$exception_list as
    | ExceptionListEntry[]
    | undefined
  if (
    Array.isArray(entries) &&
    entries.length > 0 &&
    entries.every(isBrowserExtensionRejection)
  ) {
    return null
  }
  return event
}

function sanitizePostHogEvent(event: CaptureResult | null): CaptureResult | null {
  const filtered = dropBrowserExtensionExceptions(event)
  return filtered ? sanitizeAnalyticsPayload(filtered) : null
}

function initializePostHog(): boolean {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const uiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST
  if (!projectToken || !host || !uiHost) return false
  if (postHogInitialized) return true

  posthog.init(projectToken, {
    api_host: host,
    ui_host: uiHost,
    before_send: sanitizePostHogEvent,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: false,
    enable_recording_console_log: false,
    mask_all_text: false,
    mask_all_element_attributes: false,
    person_profiles: 'never',
    persistence: 'localStorage+cookie',
    respect_dnt: false,
    session_recording: {
      blockSelector: '[data-giving-private]',
      maskAllInputs: true,
      maskAllElementAttributes: false,
      maskTextSelector: ':not(*)',
    },
  })
  postHogInitialized = true
  return true
}

function startPrivateCapture() {
  if (!postHogInitialized || privateCaptureActive) return
  posthog.startExceptionAutocapture()
  posthog.startSessionRecording(true)
  privateCaptureActive = true
}

function stopPrivateCapture() {
  if (!postHogInitialized || !privateCaptureActive) return
  posthog.stopSessionRecording()
  posthog.stopExceptionAutocapture()
  privateCaptureActive = false
}

export function AnalyticsManager() {
  const pathname = usePathname()
  const { givingViewActive, setFlagState } = useGivingExperience()
  const mayTrack = canTrackAnalyticsPath(pathname)
  const privatePath = mustPauseAnalyticsCapture(pathname)
  const pausePrivateCapture = givingViewActive || privatePath

  useEffect(() => {
    if (privatePath) {
      setFlagState('failed')
      return
    }
    if (!initializePostHog()) {
      setFlagState('failed')
      return
    }

    try {
      return posthog.onFeatureFlags((_flags, _variants, context) => {
        if (context?.errorsLoading) {
          setFlagState('failed')
          return
        }
        try {
          const enabled = posthog.isFeatureEnabled(GIVING_FLAG_KEY, {
            fresh: true,
            send_event: false,
          })
          setFlagState(enabled === true ? 'enabled' : enabled === false ? 'disabled' : 'failed')
        } catch {
          setFlagState('failed')
        }
      })
    } catch {
      setFlagState('failed')
    }
  }, [privatePath, setFlagState])

  useEffect(() => {
    if (GA_ID) {
      ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = !mayTrack
    }

    if (pausePrivateCapture) {
      stopPrivateCapture()
      return
    }

    if (!initializePostHog()) return
    startPrivateCapture()

    posthog.capture('$pageview', {
      $current_url: `${window.location.origin}${pathname}`,
      $pathname: pathname,
    })
  }, [mayTrack, pathname, pausePrivateCapture])

  return mayTrack && !givingViewActive
    ? <GoogleAnalytics pagePath={pathname} />
    : null
}
