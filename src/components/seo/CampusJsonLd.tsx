import { UNICHURCH_SCHEMA_ADDRESS } from '@/lib/seo-addresses'

interface CampusSchemaProps {
  name: string
  brandName: string
  slug: string
  address?: {
    street?: string | null
    city?: string | null
    postalCode?: string | null
  } | null
  geoPoint?: {
    lat?: number | null
    lng?: number | null
  } | null
  mapUrl?: string
  serviceDay: string
  serviceOpens: string
  serviceCloses: string
}

export function CampusJsonLd({
  name,
  brandName,
  slug,
  address,
  geoPoint,
  mapUrl,
  serviceDay,
  serviceOpens,
  serviceCloses,
}: CampusSchemaProps) {
  const schemaAddress =
    slug === 'unichurch'
      ? UNICHURCH_SCHEMA_ADDRESS
      : {
          '@type': 'PostalAddress',
          streetAddress: address?.street ?? '',
          addressLocality: address?.city ?? '',
          addressRegion: 'Auckland',
          postalCode: address?.postalCode ?? '',
          addressCountry: 'NZ',
        }

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    '@id': `https://www.ev.church/campus/${slug}#church`,
    name: `Ev Church ${name}`,
    alternateName: brandName,
    url: `https://www.ev.church/campus/${slug}`,
    address: schemaAddress,
    ...(geoPoint?.lat != null && geoPoint.lng != null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: geoPoint.lat,
            longitude: geoPoint.lng,
          },
        }
      : {}),
    ...(mapUrl ? { hasMap: mapUrl } : {}),
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: serviceDay,
      opens: serviceOpens,
      closes: serviceCloses,
    },
    isAccessibleForFree: true,
    publicAccess: true,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
