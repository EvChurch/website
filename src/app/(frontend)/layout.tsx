import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner'
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd'
import { GoogleAnalytics } from '@/components/seo/GoogleAnalytics'
import { MediaPlayerProvider } from '@/components/media/MediaPlayerProvider'
import { VideoContainer } from '@/components/media/VideoContainer'
import { AudioPlayerBar } from '@/components/audio/AudioPlayerBar'
import { AudioPlayerSpacer } from '@/components/audio/AudioPlayerSpacer'
import { isMemberAuthEnabled } from '@/auth/member-auth0-config'
import { getCurrentMemberProfileState } from '@/auth/member-session'
import '@/styles/globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ev.church'),
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
    type: 'website',
    locale: 'en_NZ',
    url: 'https://ev.church',
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
  const rockProfileState = isMemberAuthEnabled()
    ? await getCurrentMemberProfileState()
    : undefined
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

  return (
    <html lang="en">
      <head>
        {/* Adobe Fonts preconnect for faster font loading */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://use.typekit.net" />
        <OrganizationJsonLd />
      </head>
      <body className="bg-brand-black font-sans text-brand-black antialiased">
        <MediaPlayerProvider>
          <GoogleAnalytics />
          <AnnouncementBanner />
          <Header memberProfile={memberProfile} />
          <main>{children}</main>
          <Footer />
          <AudioPlayerSpacer />
          <AudioPlayerBar />
          <VideoContainer />
        </MediaPlayerProvider>
      </body>
    </html>
  )
}
