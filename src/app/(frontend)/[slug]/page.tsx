import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { getPayloadClient } from '@/lib/payload'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { trackedNotFound } from '@/lib/tracked-not-found'
import { isRetiredPageSlug } from '@/lib/public-pages'
import { DEFAULT_OPEN_GRAPH_IMAGES, truncateMetaDescription } from '@/lib/seo-metadata'
import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { SimpleContentPage } from '@/components/pages/SimpleContentPage'
import { BreadcrumbJsonLd, buildBreadcrumbs } from '@/components/seo/BreadcrumbJsonLd'

export const revalidate = 86400

async function fetchPageBySlug(slug: string) {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })

  return result.docs[0] ?? null
}

const getCachedPageBySlug = unstable_cache(
  fetchPageBySlug,
  ['public-page-by-slug'],
  { tags: [CACHE_TAGS.pages], revalidate: 86_400 },
)

const getPageBySlug = cache(getCachedPageBySlug)

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (isRetiredPageSlug(slug)) return {}

  const page = await getPageBySlug(slug)

  if (!page) return {}

  const seo = page.seo as
    | {
        metaTitle?: string | null
        metaDescription?: string | null
        ogImage?: { url: string; width?: number; height?: number; alt?: string } | null
      }
    | undefined

  const title = seo?.metaTitle
    ? { absolute: seo.metaTitle }
    : `${page.title} | Ev Church`
  const displayTitle = seo?.metaTitle ?? `${page.title} | Ev Church`
  const description = truncateMetaDescription(
    seo?.metaDescription ??
      `Learn about ${page.title} at Ev Church, a Christian community across Auckland, Tamaki Makaurau. Find practical details, helpful resources, and ways to connect with us.`,
  )

  const ogImage = seo?.ogImage
  const images = ogImage
    ? [{ url: ogImage.url, width: ogImage.width, height: ogImage.height, alt: ogImage.alt ?? '' }]
    : undefined

  return {
    title,
    description,
    openGraph: {
      title: displayTitle,
      description,
      url: `https://www.ev.church/${slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
      images: images ?? DEFAULT_OPEN_GRAPH_IMAGES,
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
      description,
    },
    alternates: {
      canonical: `https://www.ev.church/${slug}`,
    },
  }
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (isRetiredPageSlug(slug)) trackedNotFound(slug)

  const page = await getPageBySlug(slug)

  if (!page) trackedNotFound(slug)


  const blocks = (page.layout ?? []) as any[]
  const breadcrumbs = buildBreadcrumbs(`/${slug}`, page.title)

  if (page.template === 'simple-content') {
    const sections = blocks
      .filter((block) => block.blockType === 'content')
      .map((block) => ({
        id: block.id,
        heading: block.heading,
        body: block.body,
      }))

    return (
      <>
        <BreadcrumbJsonLd items={breadcrumbs} />
        <SimpleContentPage
          title={page.title}
          updatedAt={page.updatedAt}
          sections={sections}
        />
      </>
    )
  }

  // Generate FAQPage JSON-LD from accordion blocks on the FAQ page
  let faqJsonLd: React.ReactNode = null
  if (slug === 'faq') {
    const faqItems: { question: string; answer: string }[] = []
    for (const block of blocks) {
      if (block.blockType === 'accordion' && Array.isArray(block.items)) {
        for (const item of block.items) {
          if (item.question && item.answer) {
            faqItems.push({
              question: item.question,
              answer: typeof item.answer === 'string' ? item.answer : '',
            })
          }
        }
      }
    }
    if (faqItems.length > 0) {
      const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      }
      faqJsonLd = (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )
    }
  }

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />
      {faqJsonLd}
      <RenderBlocks blocks={blocks} />
    </>
  )
}
