import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Central Campus Events | Ev Church Auckland',
  description: 'Find upcoming events and community gatherings at Ev Church Central Campus in Auckland.',
  alternates: { canonical: 'https://www.ev.church/events/central' },
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
