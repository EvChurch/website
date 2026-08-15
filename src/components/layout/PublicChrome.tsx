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
}: {
  children: ReactNode
  feedback: PublicSiteFeedbackSettings | null
  launcher: LauncherData
  announcement: ReactNode
  footer: ReactNode
}) {
  const pathname = usePathname()
  const sharedResource = matchesPathPrefix(pathname, '/shared/leader-resources')
  const [memberChrome, setMemberChrome] = useState<MemberChromeState>(ANONYMOUS_MEMBER_CHROME)

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
      />
    </MediaPlayerProvider>
  )
}
