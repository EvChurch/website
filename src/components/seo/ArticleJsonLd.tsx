// TODO: Activate when blog is CMS-connected. Do not render on placeholder blog posts.

interface ArticleJsonLdProps {
  headline: string
  author: string
  datePublished: string
  dateModified?: string
  image?: string
  description?: string
  url: string
}

export function ArticleJsonLd({
  headline,
  author,
  datePublished,
  dateModified,
  image,
  description,
  url,
}: ArticleJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    author: {
      '@type': 'Person',
      name: author,
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
    datePublished,
    ...(dateModified && { dateModified }),
    ...(image && { image }),
    ...(description && { description }),
    url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
