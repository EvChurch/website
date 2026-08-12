'use client'

import { useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'

import {
  canReplayPath,
  canTrackAnalyticsPath,
} from '@/lib/analytics-privacy'
import { GA_ID, GoogleAnalytics } from './GoogleAnalytics'

let postHogInitialized = false

function initializePostHog(shouldReplay: boolean): boolean {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!projectToken || !host) return false
  if (postHogInitialized) return true

  posthog.init(projectToken, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: !shouldReplay,
    enable_recording_console_log: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    person_profiles: 'never',
    persistence: 'localStorage+cookie',
    respect_dnt: true,
    session_recording: {
      blockSelector: 'form,[data-analytics-sensitive]',
      maskAllInputs: true,
      maskAllElementAttributes: true,
    },
  })
  postHogInitialized = true
  return true
}

export function AnalyticsManager() {
  const pathname = usePathname()
  const pagePath = pathname
  const mayTrack = canTrackAnalyticsPath(pathname)

  useLayoutEffect(() => {
    if (mayTrack || !postHogInitialized) return

    posthog.stopExceptionAutocapture()
    posthog.stopSessionRecording()
  }, [mayTrack])

  useEffect(() => {
    if (GA_ID) {
      ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = !mayTrack
    }

    const shouldReplay = canReplayPath(pathname)

    if (!mayTrack || !initializePostHog(shouldReplay)) {
      if (postHogInitialized) {
        posthog.stopExceptionAutocapture()
        posthog.stopSessionRecording()
      }
      return
    }

    posthog.startExceptionAutocapture()
    posthog.capture('$pageview', {
      $current_url: `${window.location.origin}${pathname}`,
      $pathname: pathname,
    })

    if (shouldReplay) {
      posthog.startSessionRecording()
    } else {
      posthog.stopSessionRecording()
    }
  }, [mayTrack, pagePath, pathname])

  return mayTrack ? <GoogleAnalytics pagePath={pagePath} /> : null
}
