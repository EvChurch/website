import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import { Albert_Sans, Source_Serif_4 } from 'next/font/google'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner'
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd'
import { AnalyticsManager } from '@/components/seo/AnalyticsManager'
import { MediaPlayerProvider } from '@/components/media/MediaPlayerProvider'
import { VideoContainer } from '@/components/media/VideoContainer'
import { AudioPlayerBar } from '@/components/audio/AudioPlayerBar'
import { AudioPlayerSpacer } from '@/components/audio/AudioPlayerSpacer'
import { isMemberAuthEnabled } from '@/auth/member-auth0-config'
import { getCurrentMemberProfileState } from '@/auth/member-session'
import { getCurrentMemberImpersonation } from '@/auth/member-impersonation'
import { isCurrentPayloadAdmin } from '@/auth/payload-admin-session'
import { NextStepsLauncher } from '@/components/launcher/NextStepsLauncher'
import { GivingExperienceProvider } from '@/components/giving/GivingExperienceProvider'
import { GivingFlow } from '@/components/giving/GivingFlow'
import { resolveGivingRuntimeConfiguration } from '@/lib/giving/availability'
import { getCachedActiveGivingFunds } from '@/lib/giving/funds'
import { createGivingRockClient } from '@/lib/giving/rock-client'
import { resolveCurrentGivingMemberIdentity } from '@/auth/giving-member-identity'
import { givingCapabilityCookieNames } from '@/lib/giving/drafts'
import { getTurnstileSiteKey } from '@/lib/rock-forms/config'
import { createGivingE2ESessionService, createPayloadGivingE2ESessionStore, GIVING_E2E_COOKIE } from '@/lib/giving/e2e-session'
import { getPayloadClient } from '@/lib/payload'
import { getAuth0Client } from '@/auth/auth0-client'
import { loadLauncherData } from '@/lib/launcher/service-guide'
import { loadSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'
import '@/styles/globals.css'

const albertSans = Albert_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-albert-sans',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  style: 'italic',
  variable: '--font-source-serif',
  display: 'swap',
})

const fontVariables = `${albertSans.variable} ${sourceSerif.variable}`

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ev.church'),
  title: {
    default: 'Church in Auckland | Ev Church NZ | Sunday Services & Community',
    template: '%s | Ev Church',
  },
  description:
    'Looking for a church in Auckland? Ev Church is a community of Christ-followers meeting across Tāmaki Makaurau. Join us this Sunday or explore faith with us.',
  keywords: [
    'Ev Church',
    'Auckland church',
    'New Zealand church',
    'Christian community Auckland',
    'Sunday service Auckland',
    'North Shore church',
    'Rosedale church',
    'Hillsborough church',
    'university church Auckland',
  ],
  authors: [{ name: 'Ev Church' }],
  creator: 'Ev Church',
  publisher: 'Ev Church',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    images: DEFAULT_OPEN_GRAPH_IMAGES,
    type: 'website',
    locale: 'en_NZ',
    url: 'https://www.ev.church',
    siteName: 'Ev Church',
    title: 'Church in Auckland | Ev Church NZ | Sunday Services & Community',
    description:
      'Looking for a church in Auckland? Ev Church is a community of Christ-followers meeting across Tāmaki Makaurau. Join us this Sunday or explore faith with us.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Church in Auckland | Ev Church NZ',
    description:
      'A community of Christ-followers meeting across Tāmaki Makaurau. Join us this Sunday.',
  },
  other: {
    'google-site-verification': '',
  },
}

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  themeColor: '#E22A30',
  width: 'device-width',
  initialScale: 1,
}

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const isSharedResource = requestHeaders.get('x-ev-shared-resource') === '1'
  if (isSharedResource) {
    return (
      <html lang="en" className={fontVariables}>
        <body className="bg-warm-white font-sans text-brand-black antialiased">
          <Header />
          <main>{children}</main>
          <Footer />
        </body>
      </html>
    )
  }
  const requestCookies = await cookies()
  let protectedE2E = false
  const e2eToken = requestCookies.get(GIVING_E2E_COOKIE)?.value
  if (e2eToken) {
    try {
      const payload = await getPayloadClient()
      protectedE2E = Boolean(await createGivingE2ESessionService(createPayloadGivingE2ESessionStore(payload)).read(e2eToken))
    } catch {
      protectedE2E = false
    }
  }
  const givingRuntime = resolveGivingRuntimeConfiguration({ protectedE2E })
  const initialGivingEligibility = givingRuntime?.eligibility ?? null
  const [launcher, feedback, rockProfileState, payloadAdmin, impersonation, givingFunds] = await Promise.all([
    loadLauncherData(),
    loadSiteFeedbackSettings(),
    isMemberAuthEnabled() ? getCurrentMemberProfileState() : undefined,
    isCurrentPayloadAdmin(requestHeaders),
    getCurrentMemberImpersonation(),
    initialGivingEligibility ? getCachedActiveGivingFunds() : Promise.resolve([]),
  ])
  const memberProfile = rockProfileState === undefined
    ? undefined
    : rockProfileState === null
      ? null
      : {
          name: rockProfileState.profile.name,
          email: rockProfileState.profile.email,
          avatarUrl:
            rockProfileState.profile.photoUrl || rockProfileState.needsRefresh
              ? '/member-avatar'
              : null,
        }
  let givingEligibility = initialGivingEligibility
  let givingIdentity: { signedIn: boolean; firstName?: string; lastName?: string; email?: string } = { signedIn: false }
  if (isMemberAuthEnabled() && givingEligibility) {
    try {
      const session = await getAuth0Client().getSession()
      if (typeof session?.user?.sub === 'string' && session.user.sub) {
        const resolved = await resolveCurrentGivingMemberIdentity({ rockClient: createGivingRockClient() })
        if (!resolved.signedIn) throw new Error('Giving member identity unavailable')
        givingIdentity = {
          signedIn: true,
          ...(resolved.firstName ? { firstName: resolved.firstName } : {}),
          ...(resolved.lastName ? { lastName: resolved.lastName } : {}),
          ...(resolved.email ? { email: resolved.email } : {}),
        }
      }
    } catch {
      givingEligibility = null
    }
  }
  const secureRequest = process.env.NODE_ENV === 'production'
  const resumeRequested = Boolean(
    requestCookies.get(givingCapabilityCookieNames(secureRequest).resume)?.value ||
    requestCookies.get('__Host-ev_giving_checkout')?.value,
  )

  return (
    <html lang="en" className={fontVariables}>
      <head>
        <OrganizationJsonLd />
      </head>
      <body className="bg-brand-black font-sans text-brand-black antialiased">
        <MediaPlayerProvider>
          <GivingExperienceProvider
            serverEligibility={givingEligibility}
            resumeRequested={resumeRequested}
            givingExperience={givingEligibility && givingFunds.length > 0 && givingRuntime ? <GivingFlow funds={givingFunds} identity={givingIdentity} resumeRequested={resumeRequested} turnstileSiteKey={getTurnstileSiteKey()} synthetic={givingRuntime.synthetic} gatewayOrigins={givingRuntime.gatewayOrigins} /> : null}
          >
            <AnalyticsManager />
            <AnnouncementBanner />
            <SiteHeader
              feedback={feedback}
              memberProfile={memberProfile}
              adminHref={payloadAdmin ? '/admin/impersonate' : undefined}
              impersonation={impersonation}
            />
            <main>{children}</main>
            <Footer />
            <AudioPlayerSpacer />
            <AudioPlayerBar />
            <VideoContainer />
            <NextStepsLauncher
              campuses={launcher.campuses}
              items={launcher.available ? launcher.items : null}
              memberCampusSlug={rockProfileState?.profile.campusSlug ?? null}
              feedback={feedback}
              signedInEmail={memberProfile?.email}
              memberProfile={memberProfile}
              adminHref={payloadAdmin ? '/admin/impersonate' : undefined}
            />
          </GivingExperienceProvider>
        </MediaPlayerProvider>
      </body>
    </html>
  )
}
