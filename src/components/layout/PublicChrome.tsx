'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { AudioPlayerBar } from '@/components/audio/AudioPlayerBar'
import { AudioPlayerSpacer } from '@/components/audio/AudioPlayerSpacer'
import { NextStepsLauncher } from '@/components/launcher/NextStepsLauncher'
import { MediaPlayerProvider } from '@/components/media/MediaPlayerProvider'
import { VideoContainer } from '@/components/media/VideoContainer'
import { AnalyticsManager } from '@/components/seo/AnalyticsManager'
import type { LauncherData } from '@/lib/launcher/types'
import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import { Footer } from './Footer'
import { Header } from './Header'
import type { MemberDisplayProfile } from './MemberAccountControl'
import { SiteHeader } from './SiteHeader'

interface MemberChromeState {
  memberProfile: MemberDisplayProfile | null
  memberCampusSlug: string | null
  adminHref: string | null
  impersonation: {
    personId: number
    name: string
    email: string
  } | null
}

const ANONYMOUS_CHROME: MemberChromeState = {
  memberProfile: null,
  memberCampusSlug: null,
  adminHref: null,
  impersonation: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function memberChromeState(value: unknown): MemberChromeState | null {
  if (!isRecord(value)) return null

  const profile = value.memberProfile
  const impersonation = value.impersonation
  if (
    profile !== null &&
    (!isRecord(profile) ||
      typeof profile.name !== 'string' ||
      typeof profile.email !== 'string' ||
      !(typeof profile.avatarUrl === 'string' || profile.avatarUrl === null))
  ) return null
  if (
    impersonation !== null &&
    (!isRecord(impersonation) ||
      typeof impersonation.personId !== 'number' ||
      typeof impersonation.name !== 'string' ||
      typeof impersonation.email !== 'string')
  ) return null
  if (
    !(typeof value.memberCampusSlug === 'string' || value.memberCampusSlug === null) ||
    !(typeof value.adminHref === 'string' || value.adminHref === null)
  ) return null

  return value as unknown as MemberChromeState
}

function isSharedLeaderResource(pathname: string) {
  return pathname === '/shared/leader-resources' ||
    pathname.startsWith('/shared/leader-resources/')
}

export function PublicChrome({
  children,
  feedback,
  launcher,
  announcement,
}: {
  children: ReactNode
  feedback: PublicSiteFeedbackSettings | null
  launcher: LauncherData
  announcement: ReactNode
}) {
  const pathname = usePathname()
  const sharedResource = isSharedLeaderResource(pathname)
  const [memberChrome, setMemberChrome] = useState(ANONYMOUS_CHROME)

  useEffect(() => {
    if (sharedResource) return
    let cancelled = false

    void fetch('/api/member-chrome', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => response.ok ? memberChromeState(await response.json()) : null)
      .then((state) => {
        if (!cancelled && state) setMemberChrome(state)
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
      <Footer />
    </div>
  }

  return (
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
      <Footer />
      <AudioPlayerSpacer />
      <AudioPlayerBar />
      <VideoContainer />
      <NextStepsLauncher
        campuses={launcher.campuses}
        items={launcher.available ? launcher.items : null}
        memberCampusSlug={memberChrome.memberCampusSlug}
        feedback={feedback}
        signedInEmail={memberChrome.memberProfile?.email}
      />
    </MediaPlayerProvider>
  )
}
