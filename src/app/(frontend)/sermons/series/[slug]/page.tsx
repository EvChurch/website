import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { getPayloadClient } from '@/lib/payload'
import { getSermonAudioUrl, getSeriesBannerUrl } from '@/lib/sermon-utils'
import { SermonCard } from '@/components/sermons/SermonCard'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

async function getSeriesBySlug(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'sermon-series',
    where: {
      and: [
        { slug: { equals: slug } },
        { isPublished: { equals: true } },
      ],
    },
    depth: 1,
    limit: 1,
  })
  return result.docs[0] ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const series = await getSeriesBySlug(slug)

  if (!series) return {}

  return {
    title: `${series.title} | Sermon Series | Ev Church`,
    description: `Listen to sermons from the "${series.title}" series at Ev Church Auckland.`,
    openGraph: {
      title: `${series.title} | Sermon Series | Ev Church`,
      description: `Listen to sermons from the "${series.title}" series at Ev Church Auckland.`,
      url: `https://ev.church/sermons/series/${series.slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
    },
    alternates: {
      canonical: `https://ev.church/sermons/series/${series.slug}`,
    },
  }
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayloadClient()
  const series = await getSeriesBySlug(slug)

  if (!series) notFound()

  // Fetch all sermons in this series
  const sermonsResult = await payload.find({
    collection: 'sermons',
    where: {
      and: [
        { isPublished: { equals: true } },
        { series: { contains: series.id } },
      ],
    },
    sort: '-publishedAt',
    limit: 200,
    depth: 2,
  })

  const backgroundUrl =
    typeof series.backgroundImage === 'object' &&
    series.backgroundImage !== null &&
    'url' in series.backgroundImage
      ? (series.backgroundImage.url as string)
      : null

  const bannerUrl =
    typeof series.bannerImage === 'object' &&
    series.bannerImage !== null &&
    'url' in series.bannerImage
      ? (series.bannerImage.url as string)
      : null

  // Use background for the hero backdrop, fall back to banner
  const heroImageUrl = backgroundUrl || bannerUrl

  const breadcrumbItems = [
    { name: 'Home', url: 'https://ev.church' },
    { name: 'Sermons', url: 'https://ev.church/sermons' },
    { name: series.title, url: `https://ev.church/sermons/series/${series.slug}` },
  ]

  return (
    <main className="bg-brand-black min-h-screen">
      <BreadcrumbJsonLd items={breadcrumbItems} />

      {/* Series header */}
      <section className="relative overflow-hidden">
        {/* Background image -- full bleed */}
        {backgroundUrl && (
          <>
            <Image
              src={backgroundUrl}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
          </>
        )}

        <div className="relative mx-auto max-w-5xl px-6 pb-12 pt-20 md:pb-16 md:pt-28">
          <div className="flex flex-col gap-8 md:flex-row md:items-end">
            {/* Banner artwork */}
            {bannerUrl && (
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl shadow-2xl md:w-72 lg:w-80">
                <Image
                  src={bannerUrl}
                  alt={series.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Text */}
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-warm-white/70">
                Sermon Series
              </p>
              <h1 className="mt-2 font-sans text-3xl font-bold text-warm-white md:text-4xl lg:text-5xl">
                {series.title}
              </h1>
              <p className="mt-2 text-sm text-warm-white/50">
                {sermonsResult.totalDocs}{' '}
                {sermonsResult.totalDocs === 1 ? 'sermon' : 'sermons'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sermon list */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            {sermonsResult.docs.map((sermon) => (
              <SermonCard
                key={sermon.id}
                id={Number(sermon.id)}
                title={sermon.title}
                slug={sermon.slug}
                speakers={
                  Array.isArray(sermon.speakers)
                    ? sermon.speakers
                        .map((s) =>
                          typeof s === 'object' && s !== null && 'name' in s
                            ? { name: s.name as string, slug: (s as { slug?: string }).slug ?? '' }
                            : null,
                        )
                        .filter((s): s is { name: string; slug: string } => s !== null)
                    : []
                }
                publishedAt={sermon.publishedAt ?? ''}
                series={
                  Array.isArray(sermon.series)
                    ? sermon.series
                        .map((s) =>
                          typeof s === 'object' && s !== null && 'title' in s
                            ? { title: s.title as string, slug: (s as { slug?: string }).slug ?? '' }
                            : null,
                        )
                        .filter((s): s is { title: string; slug: string } => s !== null)
                    : []
                }
                scriptures={
                  Array.isArray(sermon.scriptures)
                    ? sermon.scriptures
                        .map((s) =>
                          typeof s === 'object' && s !== null && 'name' in s
                            ? { name: s.name as string, slug: (s as { slug?: string }).slug ?? '' }
                            : null,
                        )
                        .filter((s): s is { name: string; slug: string } => s !== null)
                    : []
                }
                passageReference={sermon.passageReference}
                duration={sermon.duration ?? 0}
                audioUrl={getSermonAudioUrl(sermon.audio)}
                seriesBannerUrl={getSeriesBannerUrl(sermon)}
                hideSeriesBadge
              />
            ))}
          </div>

          {sermonsResult.totalDocs === 0 && (
            <p className="py-12 text-center text-warm-white/60">
              No sermons in this series yet.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
