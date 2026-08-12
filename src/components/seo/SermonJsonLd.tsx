interface SermonJsonLdProps {
  title: string
  speaker: string
  datePublished: string
  audioUrl: string
  duration: number
  seriesName?: string
  pageUrl: string
}

function formatIsoDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  let iso = 'PT'
  if (hours > 0) iso += `${hours}H`
  if (minutes > 0) iso += `${minutes}M`
  if (secs > 0) iso += `${secs}S`
  return iso || 'PT0S'
}

export function SermonJsonLd({
  title,
  speaker,
  datePublished,
  audioUrl,
  duration,
  seriesName,
  pageUrl,
}: SermonJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AudioObject',
    name: title,
    description: seriesName
      ? `${title} by ${speaker} from the series "${seriesName}"`
      : `${title} by ${speaker}`,
    contentUrl: audioUrl,
    encodingFormat: 'audio/mpeg',
    duration: formatIsoDuration(duration),
    uploadDate: datePublished,
    author: {
      '@type': 'Person',
      name: speaker,
    },
    publisher: {
      '@type': 'Organization',
      '@id': 'https://www.ev.church/#organization',
      name: 'Ev Church',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.ev.church/logo.png',
      },
    },
    ...(seriesName && {
      isPartOf: {
        '@type': 'PodcastSeries',
        name: seriesName,
      },
    }),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
