import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Events | Ev Church Auckland',
  description: 'Explore upcoming events, courses, and community gatherings at Ev Church across Auckland.',
  alternates: { canonical: 'https://www.ev.church/events' },
  openGraph: {
    title: 'Events | Ev Church Auckland',
    description: 'Find upcoming events across Ev Church North, Central, and Unichurch.',
    url: 'https://www.ev.church/events',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
}

export default function EventsPage() {
  return <EventsListing />
}
