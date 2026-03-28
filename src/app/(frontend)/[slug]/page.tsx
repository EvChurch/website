import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { RenderBlocks } from '@/components/blocks/RenderBlocks'

export const dynamic = 'force-dynamic'

async function getPageBySlug(slug: string) {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })

  return result.docs[0] ?? null
}

export async function generateStaticParams() {
  const payload = await getPayloadClient()

  const pages = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 100,
    select: { slug: true },
  })

  return pages.docs
    .filter((page) => page.slug !== 'home')
    .map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
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
  const description =
    seo?.metaDescription ??
    `Learn about ${page.title} at Ev Church, a Christian community across Auckland, Tamaki Makaurau.`

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
      url: `https://ev.church/${slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
      ...(images && { images }),
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
      description,
    },
    alternates: {
      canonical: `https://ev.church/${slug}`,
    },
  }
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = await getPageBySlug(slug)

  if (!page) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks = (page.layout ?? []) as any[]

  return <RenderBlocks blocks={blocks} />
}
