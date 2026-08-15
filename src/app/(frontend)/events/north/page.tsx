import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'North Campus Events | Ev Church Auckland',
  description: 'Find events and community gatherings at Ev Church North Campus on Auckland’s North Shore, with dates, locations, registration details, and ways to join in.',
  alternates: { canonical: 'https://www.ev.church/events/north' },
  openGraph: {
    title: 'North Campus Events | Ev Church Auckland',
    description: 'See upcoming events and community gatherings at Ev Church North Campus.',
    url: 'https://www.ev.church/events/north',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
    images: DEFAULT_OPEN_GRAPH_IMAGES,
  },
}

export default function NorthEventsPage() {
  return (
    <EventsListing
      campusSlug="north"
      heading="Events at North"
      introduction="See what’s coming up for our North Campus community on Auckland’s North Shore."
    />
  )
}
