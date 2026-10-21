import type { Sermon, SermonSery } from '@/payload-types'

interface SermonSeriesJsonLdProps {
  series: Pick<SermonSery, 'title' | 'slug' | 'updatedAt'>
  sermons: Pick<Sermon, 'title' | 'slug' | 'publishedAt'>[]
}

export function SermonSeriesJsonLd({ series, sermons }: SermonSeriesJsonLdProps) {
  const url = `https://www.ev.church/sermons/series/${series.slug}`
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name: series.title,
    dateModified: series.updatedAt,
    mainEntity: {
      '@type': 'CreativeWorkSeries',
      '@id': `${url}#series`,
      name: series.title,
      url,
      publisher: { '@id': 'https://www.ev.church/#organization' },
      hasPart: sermons.map((sermon) => ({
        '@type': 'CreativeWork',
        '@id': `https://www.ev.church/sermons/${sermon.slug}#sermon`,
        name: sermon.title,
        url: `https://www.ev.church/sermons/${sermon.slug}`,
        ...(sermon.publishedAt ? { datePublished: sermon.publishedAt } : {}),
      })),
    },
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{
    __html: JSON.stringify(data).replace(/</g, '\\u003c'),
  }} />
}
