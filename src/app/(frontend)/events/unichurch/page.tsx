import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Unichurch Events | Ev Church Auckland',
  description: 'Find events and gatherings at Ev Church Unichurch in Auckland, with dates, locations, registration details, and ways for students and young adults to join in.',
  alternates: { canonical: 'https://www.ev.church/events/unichurch' },
  openGraph: {
    title: 'Unichurch Events | Ev Church Auckland',
    description: 'See upcoming events and community gatherings at Ev Church Unichurch.',
    url: 'https://www.ev.church/events/unichurch',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
    images: DEFAULT_OPEN_GRAPH_IMAGES,
  },
}

export default function UnichurchEventsPage() {
  return (
    <EventsListing
      campusSlug="unichurch"
      heading="Events at Unichurch"
      introduction="See what’s coming up for students, young adults, and the wider Unichurch community."
    />
  )
}
