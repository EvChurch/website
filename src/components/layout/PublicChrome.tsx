'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { AudioPlayerBar } from '@/components/audio/AudioPlayerBar'
import { AudioPlayerSpacer } from '@/components/audio/AudioPlayerSpacer'
import { GivingExperienceProvider } from '@/components/giving/GivingExperienceProvider'
import { GivingFlow } from '@/components/giving/GivingFlow'
import { GivingUnavailable } from '@/components/giving/GivingUnavailable'
import { NextStepsLauncher } from '@/components/launcher/NextStepsLauncher'
import { MediaPlayerProvider } from '@/components/media/MediaPlayerProvider'
import { VideoContainer } from '@/components/media/VideoContainer'
import { AnalyticsManager } from '@/components/seo/AnalyticsManager'
import type { LauncherData } from '@/lib/launcher/types'
import type { GivingRuntimeConfiguration } from '@/lib/giving/availability'
import type { PublicGivingFund } from '@/lib/giving/contracts'
import {
  ANONYMOUS_MEMBER_CHROME,
  isAnonymousMemberChrome,
  parseMemberChromeState,
  type MemberChromeState,
} from '@/lib/member-chrome'
import { matchesPathPrefix } from '@/lib/public-paths'
import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import { Header } from './Header'
import { SiteHeader } from './SiteHeader'

export function PublicChrome({
  children,
  feedback,
  launcher,
  announcement,
  footer,
  givingFunds,
  givingRuntime,
}: {
  children: ReactNode
  feedback: PublicSiteFeedbackSettings | null
  launcher: LauncherData
  announcement: ReactNode
  footer: ReactNode
  givingFunds: PublicGivingFund[]
  givingRuntime: GivingRuntimeConfiguration | null
}) {
  const pathname = usePathname()
  const sharedResource = matchesPathPrefix(pathname, '/shared/leader-resources')
  const initialRoute = useRef(true)
  const [memberChrome, setMemberChrome] = useState<MemberChromeState>(ANONYMOUS_MEMBER_CHROME)
  const [givingResumeRequested, setGivingResumeRequested] = useState(false)
  const [givingTurnstileSiteKey, setGivingTurnstileSiteKey] = useState('')

  useLayoutEffect(() => {
    if (initialRoute.current) {
      initialRoute.current = false
      return
    }

    const root = document.documentElement
    root.dataset.routeTransition = 'true'
    const timeout = window.setTimeout(() => {
      delete root.dataset.routeTransition
    }, 1_250)

    return () => {
      window.clearTimeout(timeout)
      delete root.dataset.routeTransition
    }
  }, [pathname])

  useEffect(() => {
    if (sharedResource) return
    let cancelled = false

    void fetch('/api/member-chrome', {
      cache: 'no-store',
      credentials: 'same-origin',
      })
      .then(async (response) => response.ok ? parseMemberChromeState(await response.json()) : null)
      .then((state) => {
        if (!cancelled && state) {
          setMemberChrome((current) =>
            isAnonymousMemberChrome(current) && isAnonymousMemberChrome(state)
              ? current
              : state,
          )
          setGivingResumeRequested(state.givingResumeRequested)
          setGivingTurnstileSiteKey(state.givingTurnstileSiteKey ?? '')
        }
      })
      .catch(() => {
        // Anonymous chrome is the safe fallback when private state is unavailable.
      })

    return () => { cancelled = true }
  }, [sharedResource])

  if (sharedResource) {
    return <div className="bg-warm-white text-brand-black">
      <Header />
      <main>{children}</main>
      {footer}
    </div>
  }

  const givingExperience = givingFunds.length > 0
    ? <GivingFlow
        funds={givingFunds}
        identity={{ signedIn: memberChrome.memberProfile !== null }}
        resumeRequested={givingResumeRequested}
        turnstileSiteKey={givingTurnstileSiteKey}
        gatewayOrigins={givingRuntime?.gatewayOrigins ?? []}
      />
    : <GivingUnavailable />

  return (
    <GivingExperienceProvider
      serverEligibility={givingRuntime?.eligibility ?? null}
      resumeRequested={givingResumeRequested}
      givingExperience={givingExperience}
    >
      <MediaPlayerProvider>
        <AnalyticsManager />
        {announcement}
        <SiteHeader
          feedback={feedback}
          memberProfile={memberChrome.memberProfile}
          adminHref={memberChrome.adminHref ?? undefined}
          impersonation={memberChrome.impersonation}
        />
        <main>{children}</main>
        {footer}
        <AudioPlayerSpacer />
        <AudioPlayerBar />
        <VideoContainer />
        <NextStepsLauncher
          campuses={launcher.campuses}
          items={launcher.available ? launcher.items : null}
          memberCampusSlug={memberChrome.memberCampusSlug}
          feedback={feedback}
          signedInEmail={memberChrome.memberProfile?.email}
          memberProfile={memberChrome.memberProfile}
          adminHref={memberChrome.adminHref ?? undefined}
        />
      </MediaPlayerProvider>
    </GivingExperienceProvider>
  )
}
