import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Albert_Sans, Source_Serif_4 } from 'next/font/google'
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner'
import { PublicChrome } from '@/components/layout/PublicChrome'
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd'
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

export const viewport: Viewport = {
  themeColor: '#E22A30',
  width: 'device-width',
  initialScale: 1,
}

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const [launcher, feedback] = await Promise.all([
    loadLauncherData(),
    loadSiteFeedbackSettings(),
  ])

  return (
    <html lang="en" className={fontVariables}>
      <head>
        <OrganizationJsonLd />
      </head>
      <body className="bg-brand-black font-sans text-brand-black antialiased">
        <PublicChrome
          launcher={launcher}
          feedback={feedback}
          announcement={<AnnouncementBanner />}
        >
          {children}
        </PublicChrome>
      </body>
    </html>
  )
}
