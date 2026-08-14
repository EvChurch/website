import {
  getCampusAddress,
  getCampusName,
  getEventImage,
  getRegistrationHref,
  isPastEvent,
  toPlainText,
  type PublicEvent,
} from '@/lib/events'
import { getPayloadMediaUrl } from '@/lib/payload-media'

export function EventJsonLd({ event }: { event: PublicEvent }) {
  const image = getEventImage(event)
  const imageUrl = image ? getPayloadMediaUrl(image, 'large') : null
  const registrationHref = getRegistrationHref(event)
  const past = isPastEvent(event)
  const locationName = event.location?.name?.trim() || getCampusName(event) || 'Ev Church'
  const explicitAddress = event.location?.address?.trim()
  const address = explicitAddress
    || getCampusAddress(event)
    || (/\d/u.test(locationName) ? locationName : null)

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: toPlainText(event.summary) || `An upcoming event at Ev Church in Auckland.`,
    url: `https://www.ev.church/events/${event.slug}`,
    ...(event.startDate ? { startDate: event.startDate } : {}),
    ...(event.endDate ? { endDate: event.endDate } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: locationName,
      ...(address
        ? {
            address: {
              '@type': 'PostalAddress',
              streetAddress: address,
              addressCountry: 'NZ',
            },
          }
        : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: 'Ev Church',
      url: 'https://www.ev.church',
    },
    ...(imageUrl ? { image: [imageUrl] } : {}),
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
