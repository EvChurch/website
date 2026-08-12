interface CampusSchemaProps {
  name: string
  brandName: string
  slug: string
  streetAddress: string
  addressLocality: string
  serviceDay: string
  serviceOpens: string
  serviceCloses: string
}

export function CampusJsonLd({
  name,
  brandName,
  slug,
  streetAddress,
  addressLocality,
  serviceDay,
  serviceOpens,
  serviceCloses,
}: CampusSchemaProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    '@id': `https://www.ev.church/campus/${slug}#church`,
    name: `Ev Church ${name}`,
    alternateName: brandName,
    url: `https://www.ev.church/campus/${slug}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality,
      addressRegion: 'Auckland',
      addressCountry: 'NZ',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: serviceDay,
      opens: serviceOpens,
      closes: serviceCloses,
    },
    parentOrganization: {
      '@type': 'Church',
      '@id': 'https://www.ev.church/#organization',
      name: 'Ev Church',
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
