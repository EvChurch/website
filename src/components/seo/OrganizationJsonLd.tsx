import { SOCIAL_LINKS } from '@/lib/social-links'
import { UNICHURCH_SCHEMA_ADDRESS } from '@/lib/seo-addresses'

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://www.ev.church/#organization',
    name: 'Ev Church',
    alternateName: 'Auckland Evangelical Church',
    url: 'https://www.ev.church',
    logo: 'https://www.ev.church/images/global/ev-church-logo.png',
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
      UNICHURCH_SCHEMA_ADDRESS,
    ],
    location: ['north', 'central', 'unichurch'].map((slug) => ({
      '@type': 'Church',
      '@id': `https://www.ev.church/campus/${slug}#church`,
      url: `https://www.ev.church/campus/${slug}`,
    })),
    sameAs: SOCIAL_LINKS.map(({ href }) => href),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
