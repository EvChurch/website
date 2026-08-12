import type { Metadata } from 'next'

import { EventsListing } from '@/components/events/EventsListing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unichurch Events | Ev Church Auckland',
  description: 'Find upcoming events and community gatherings at Ev Church Unichurch in Auckland.',
  alternates: { canonical: 'https://www.ev.church/events/unichurch' },
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
