'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'

import { canTrackAnalyticsPath } from '@/lib/analytics-privacy'
import { GA_ID, GoogleAnalytics } from './GoogleAnalytics'

let postHogInitialized = false

function initializePostHog(): boolean {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const uiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST
  if (!projectToken || !host || !uiHost) return false
  if (postHogInitialized) return true

  posthog.init(projectToken, {
    api_host: host,
    ui_host: uiHost,
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
      blockSelector: ':not(*)',
      maskAllInputs: true,
      maskAllElementAttributes: false,
      maskTextSelector: ':not(*)',
    },
  })
  posthog.startExceptionAutocapture()
  posthog.startSessionRecording(true)
  postHogInitialized = true
  return true
}

export function AnalyticsManager() {
  const pathname = usePathname()
  const mayTrack = canTrackAnalyticsPath(pathname)

  useEffect(() => {
    if (GA_ID) {
      ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = !mayTrack
    }

    if (!initializePostHog()) return

    posthog.capture('$pageview', {
      $current_url: `${window.location.origin}${pathname}`,
      $pathname: pathname,
    })
  }, [mayTrack, pathname])

  return mayTrack ? <GoogleAnalytics pagePath={pathname} /> : null
}
