import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Central Campus Events | Ev Church Auckland',
  description: 'Find upcoming events and community gatherings at Ev Church Central Campus in Auckland, with dates, locations, registration details, and ways to join in.',
  alternates: { canonical: 'https://www.ev.church/events/central' },
  openGraph: {
    title: 'Central Campus Events | Ev Church Auckland',
    description: 'See upcoming events and community gatherings at Ev Church Central Campus.',
    url: 'https://www.ev.church/events/central',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
    images: DEFAULT_OPEN_GRAPH_IMAGES,
  },
}

export default function CentralEventsPage() {
  return (
    <EventsListing
      campusSlug="central"
      heading="Events at Central"
      introduction="See what’s coming up for our Central Campus community in the heart of Auckland."
    />
  )
}
