'use client'

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

import { AudioPlayerBar } from '@/components/audio/AudioPlayerBar'
import { AudioPlayerSpacer } from '@/components/audio/AudioPlayerSpacer'
import { GivingExperienceProvider } from '@/components/giving/GivingExperienceProvider'
import { CAMPAIGN_CHECKOUT_FUND_CODE } from '@/lib/giving/campaign-checkout'
import { useCampaignGivingAccess } from '@/components/giving/useCampaignGivingAccess'
import { GivingUnavailable } from '@/components/giving/GivingUnavailable'
import { NextStepsLauncher } from '@/components/launcher/NextStepsLauncher'
import { MediaPlayerProvider } from '@/components/media/MediaPlayerProvider'
import { VideoContainer } from '@/components/media/VideoContainer'
import { AnalyticsManager } from '@/components/seo/AnalyticsManager'
import type { LauncherData } from '@/lib/launcher/types'
import type { GivingRuntimeConfiguration } from '@/lib/giving/availability'
import type { PublicGivingFund } from '@/lib/giving/contracts'
import type { PublicSupportProfile } from '@/lib/giving/support-profiles'
import { DEFAULT_GIVING_TRANSACTION_FEE_MINOR } from '@/lib/giving/fees'
import {
  ANONYMOUS_MEMBER_CHROME,
  isAnonymousMemberChrome,
  parseMemberChromeState,
  type MemberChromeState,
} from '@/lib/member-chrome'
import { matchesPathPrefix } from '@/lib/public-paths'
import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import { HelpHeader } from '@/components/help/HelpHeader'
import { Header } from './Header'
import { SiteHeader } from './SiteHeader'

// The launcher renders this only when giving is opened, including payment returns.
const GivingFlow = dynamic(
  () => import('@/components/giving/GivingFlow').then((module) => module.GivingFlow),
  { loading: () => <p role="status" className="p-6 text-dark-grey">Loading giving…</p> },
)
const CampaignGivingFlow = dynamic(
  () => import('@/components/giving/GiveSundayCart').then(module => module.GiveSundayCart),
  { loading: () => <p role="status" className="p-6 text-dark-grey">Loading opportunities…</p> },
)

export function PublicChrome({
  children,
  feedback,
  launcher,
  announcement,
  footer,
  givingFunds,
  givingTransactionFeeMinor = DEFAULT_GIVING_TRANSACTION_FEE_MINOR,
  givingRuntime,
  supportProfiles = [],
  campaignGivingEnabled = false,
}: {
  children: ReactNode
  feedback: PublicSiteFeedbackSettings | null
  launcher: LauncherData
  announcement: ReactNode
  footer: ReactNode
  givingFunds: PublicGivingFund[]
  givingTransactionFeeMinor?: number
  givingRuntime: GivingRuntimeConfiguration | null
  supportProfiles?: PublicSupportProfile[]
  campaignGivingEnabled?: boolean
}) {
  const pathname = usePathname()
  const campaignGivingAllowed = useCampaignGivingAccess(campaignGivingEnabled)
  const helpRoute = matchesPathPrefix(pathname, '/help')
  const sharedResource = matchesPathPrefix(pathname, '/shared/leader-resources')
  const initialRoute = useRef(true)
  const [memberChrome, setMemberChrome] = useState<MemberChromeState>(ANONYMOUS_MEMBER_CHROME)
  const [givingResumeRequested, setGivingResumeRequested] = useState(false)
  const [givingTurnstileSiteKey, setGivingTurnstileSiteKey] = useState('')
  const [memberChromeResolved, setMemberChromeResolved] = useState(false)
  const [memberChromeAvailable, setMemberChromeAvailable] = useState(false)

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
          setMemberChromeAvailable(true)
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
      .finally(() => {
        if (!cancelled) setMemberChromeResolved(true)
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

  const regularGivingFunds = givingFunds.filter(fund => fund.code !== CAMPAIGN_CHECKOUT_FUND_CODE)
  const givingExperience = regularGivingFunds.length > 0
    ? <GivingFlow
        funds={regularGivingFunds}
        transactionFeeMinor={givingTransactionFeeMinor}
        identity={{ signedIn: memberChrome.memberProfile !== null }}
        resumeRequested={givingResumeRequested}
        turnstileSiteKey={givingTurnstileSiteKey}
        gatewayOrigins={givingRuntime?.gatewayOrigins ?? []}
        cardFees={givingRuntime?.card?.fees}
      />
    : <GivingUnavailable />
  const blinkPayEligible = memberChromeResolved && memberChromeAvailable && memberChrome.impersonation === null

  return (
    <GivingExperienceProvider
      serverEligibility={givingRuntime?.eligibility ?? null}
      bankAvailable={givingRuntime?.bankAvailable ?? true}
      cardAvailable={Boolean(givingRuntime?.card)}
      blinkPayEligibilityResolved={memberChromeResolved}
      blinkPayEligible={blinkPayEligible}
      resumeRequested={givingResumeRequested}
      givingExperience={givingExperience}
      campaignGivingExperience={campaignGivingEnabled ? <CampaignGivingFlow embedded renderPayment={campaign => <GivingFlow
        funds={givingFunds} campaign={campaign} transactionFeeMinor={givingTransactionFeeMinor}
        identity={{ signedIn: memberChrome.memberProfile !== null }} resumeRequested={givingResumeRequested}
        turnstileSiteKey={givingTurnstileSiteKey} gatewayOrigins={givingRuntime?.gatewayOrigins ?? []} cardFees={givingRuntime?.card?.fees}
      />} /> : null}
      campaignGivingAllowed={campaignGivingAllowed}
      supportProfiles={supportProfiles}
    >
      <MediaPlayerProvider>
        <AnalyticsManager postHogIdentity={memberChromeResolved ? memberChrome.postHogIdentity : undefined} />
        {!helpRoute && announcement}
        {helpRoute ? <HelpHeader /> : <SiteHeader
          memberProfile={memberChrome.memberProfile}
          adminHref={memberChrome.adminHref ?? undefined}
          impersonation={memberChrome.impersonation}
        />}
        <main>{children}</main>
        {footer}
        <AudioPlayerSpacer />
        <AudioPlayerBar />
        <VideoContainer />
        <Suspense fallback={null}>
          <NextStepsLauncher
            campuses={launcher.campuses}
            items={launcher.available ? launcher.items : null}
            memberCampusSlug={memberChrome.memberCampusSlug}
            feedback={feedback}
            signedInEmail={memberChrome.memberProfile?.email}
            memberProfile={memberChrome.memberProfile}
            adminHref={memberChrome.adminHref ?? undefined}
          />
        </Suspense>
      </MediaPlayerProvider>
    </GivingExperienceProvider>
  )
}
