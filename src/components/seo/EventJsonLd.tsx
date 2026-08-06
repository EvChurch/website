import {
  getCampusName,
  getEventImage,
  getRegistrationHref,
  isPastEvent,
  toPlainText,
  type PublicEvent,
} from '@/lib/events'

export function EventJsonLd({ event }: { event: PublicEvent }) {
  const image = getEventImage(event)
  const registrationHref = getRegistrationHref(event)
  const past = isPastEvent(event)
  const locationName = event.location?.name ?? getCampusName(event) ?? 'Ev Church'

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: toPlainText(event.summary) || `An upcoming event at Ev Church in Auckland.`,
    url: `https://ev.church/events/${event.slug}`,
    ...(event.startDate ? { startDate: event.startDate } : {}),
    ...(event.endDate ? { endDate: event.endDate } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: locationName,
      ...(event.location?.address
        ? { address: { '@type': 'PostalAddress', streetAddress: event.location.address } }
        : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: 'Ev Church',
      url: 'https://ev.church',
    },
    ...(image?.url ? { image: [image.url] } : {}),
    ...(!past && registrationHref
      ? {
          offers: {
            '@type': 'Offer',
            url: registrationHref,
            availability: 'https://schema.org/InStock',
            validFrom: event.updatedAt,
          },
        }
      : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
