import type { Metadata } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'
import {
  RenderBlocks,
  type RenderableBlock,
} from '@/components/blocks/RenderBlocks'

export const dynamic = 'force-dynamic'

async function getHomePage() {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'home' } },
    depth: 1,
    limit: 1,
  })

  return result.docs[0] ?? null
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getHomePage()

  if (!page) {
    return {
      title: 'Church in Auckland | Ev Church NZ | Sunday Services & Community',
    }
  }

  const seo = page.seo as
    | {
        metaTitle?: string | null
        metaDescription?: string | null
        ogImage?: { url: string; width?: number; height?: number; alt?: string } | null
      }
    | undefined

  const defaultTitle = 'Church in Auckland | Ev Church NZ | Sunday Services & Community'
  const defaultDescription =
    'Looking for a church in Auckland? Ev Church is a community of Christ-followers meeting across Tamaki Makaurau. Join us this Sunday or explore faith with us.'

  const title = seo?.metaTitle ? { absolute: seo.metaTitle } : defaultTitle
  const displayTitle = seo?.metaTitle ?? defaultTitle
  const description = seo?.metaDescription ?? defaultDescription

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
      url: 'https://www.ev.church',
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
      canonical: 'https://www.ev.church',
    },
  }
}

export default async function HomePage() {
  const page = await getHomePage()

  if (!page) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-mid-grey">Homepage content is being set up in the CMS.</p>
      </div>
    )
  }

  const blocks = (page.layout ?? []) as unknown as RenderableBlock[]

  return <RenderBlocks blocks={blocks} />
}
