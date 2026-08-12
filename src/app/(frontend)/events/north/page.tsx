import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'North Campus Events | Ev Church Auckland',
  description: 'Find upcoming events and community gatherings at Ev Church North Campus on Auckland’s North Shore.',
  alternates: { canonical: 'https://www.ev.church/events/north' },
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
