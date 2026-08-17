import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Events | Ev Church Auckland',
  description: 'Explore upcoming events, courses, and community gatherings at Ev Church across Auckland. Find dates, locations, registration details, and ways to join in.',
  alternates: { canonical: 'https://www.ev.church/events' },
  openGraph: {
    images: DEFAULT_OPEN_GRAPH_IMAGES,
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
