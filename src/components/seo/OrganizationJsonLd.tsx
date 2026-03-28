export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    '@id': 'https://ev.church/#organization',
    name: 'Ev Church',
    alternateName: 'Auckland Evangelical Church',
    url: 'https://ev.church',
    logo: 'https://ev.church/logo.png',
    description:
      'Ev Church is a community of Christ-followers across Auckland (Tamaki Makaurau), New Zealand with three campuses: North, Central, and Unichurch.',
    address: [
      {
        '@type': 'PostalAddress',
        name: 'Ev Church North',
        streetAddress: '9-11 Rothwell Avenue',
        addressLocality: 'Rosedale',
        addressRegion: 'Auckland',
        addressCountry: 'NZ',
      },
      {
        '@type': 'PostalAddress',
        name: 'Ev Church Central',
        streetAddress: '80 Olsen Avenue',
        addressLocality: 'Hillsborough',
        addressRegion: 'Auckland',
        addressCountry: 'NZ',
      },
      {
        '@type': 'PostalAddress',
        name: 'Unichurch',
        streetAddress: '24 Princes Street',
        addressLocality: 'Auckland CBD',
        addressRegion: 'Auckland',
        addressCountry: 'NZ',
      },
    ],
    areaServed: {
      '@type': 'City',
      name: 'Auckland',
    },
    isAccessibleForFree: true,
    publicAccess: true,
    sameAs: [
      'https://www.facebook.com/ev.church',
      'https://www.instagram.com/ev.church',
      'https://www.youtube.com/@ev.church',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
