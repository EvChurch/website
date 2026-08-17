'use client'

import { useEffect, useRef } from 'react'
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
import type { MemberChromeState } from '@/lib/member-chrome'

let postHogInitialized = false
let privateCaptureActive = false
export const POSTHOG_FLAG_TIMEOUT_MS = 3_000

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
  if (!filtered) return null

  const sanitized = sanitizeAnalyticsPayload(filtered)
  if (filtered.event !== '$identify' && filtered.event !== '$set') {
    return sanitized
  }

  const originalProperties = filtered.properties as Record<string, unknown>
  const sanitizedProperties = sanitized.properties as Record<string, unknown>
  const identityProperties = originalProperties.$set
  const safeIdentityProperties: Record<string, string> = {}

  if (identityProperties && typeof identityProperties === 'object') {
    for (const key of ['email', 'name'] as const) {
      const value = (identityProperties as Record<string, unknown>)[key]
      if (typeof value === 'string' && value.length <= 320) {
        safeIdentityProperties[key] = value
      }
    }
  }

  for (const key of ['distinct_id', '$anon_distinct_id'] as const) {
    const value = originalProperties[key]
    if (typeof value === 'string' && value.length <= 200) {
      sanitizedProperties[key] = value
    }
  }
  if (Object.keys(safeIdentityProperties).length > 0) {
    sanitizedProperties.$set = safeIdentityProperties
  }

  return { ...sanitized, properties: sanitizedProperties }
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
    disable_surveys: true,
    disable_session_recording: false,
    enable_recording_console_log: false,
    mask_all_text: false,
    mask_all_element_attributes: false,
    person_profiles: 'identified_only',
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

export function AnalyticsManager({
  postHogIdentity,
}: {
  postHogIdentity?: MemberChromeState['postHogIdentity']
} = {}) {
  const pathname = usePathname()
  const { givingViewActive, setFlagState } = useGivingExperience()
  const lastIdentity = useRef<string | null | undefined>(undefined)
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
      let settled = false
      const timeout = window.setTimeout(() => {
        if (!settled) setFlagState('failed')
      }, POSTHOG_FLAG_TIMEOUT_MS)
      const unsubscribe = posthog.onFeatureFlags((_flags, _variants, context) => {
        settled = true
        window.clearTimeout(timeout)
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
      return () => {
        settled = true
        window.clearTimeout(timeout)
        unsubscribe()
      }
    } catch {
      setFlagState('failed')
    }
  }, [privatePath, setFlagState])

  useEffect(() => {
    if (privatePath || postHogIdentity === undefined || !initializePostHog()) return
    if (postHogIdentity) {
      if (lastIdentity.current === postHogIdentity.distinctId) return
      posthog.identify(postHogIdentity.distinctId, {
        email: postHogIdentity.email,
        name: postHogIdentity.name,
      })
      lastIdentity.current = postHogIdentity.distinctId
      return
    }
    if (
      typeof lastIdentity.current === 'string' ||
      typeof posthog.get_property('$user_id') === 'string'
    ) {
      posthog.reset()
    }
    lastIdentity.current = null
  }, [postHogIdentity, privatePath])

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
