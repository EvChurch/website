import type { Metadata } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { publicNotFound } from '@/lib/public-not-found'
import { getSermonAudioUrl, getSeriesBannerUrl, getSermonVideos } from '@/lib/sermon-utils'
import { SermonCard } from '@/components/sermons/SermonCard'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

async function getScriptureBySlug(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'scriptures',
    where: { slug: { equals: slug } },
    depth: 0,
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
  const scripture = await getScriptureBySlug(slug)

  if (!scripture) return {}

  return {
    title: `Sermons from ${scripture.name}`,
    description: `Explore sermons referencing ${scripture.name} from Ev Church Auckland.`,
    openGraph: {
      title: `Sermons from ${scripture.name} | Ev Church`,
      description: `Explore sermons referencing ${scripture.name} from Ev Church Auckland.`,
      url: `https://www.ev.church/sermons/scriptures/${scripture.slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
    },
    alternates: {
      canonical: `https://www.ev.church/sermons/scriptures/${scripture.slug}`,
    },
  }
}

export default async function ScripturePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayloadClient()
  const scripture = await getScriptureBySlug(slug)

  if (!scripture) publicNotFound('sermons', 'scriptures', slug)

  // Fetch sermons referencing this scripture
  const sermonsResult = await payload.find({
    collection: 'sermons',
    where: {
      and: [
        { isPublished: { equals: true } },
        { scriptures: { contains: scripture.id } },
      ],
    },
    sort: '-publishedAt',
    limit: 200,
    depth: 2,
  })

  const breadcrumbItems = [
    { name: 'Home', url: 'https://www.ev.church' },
    { name: 'Sermons', url: 'https://www.ev.church/sermons' },
    { name: scripture.name, url: `https://www.ev.church/sermons/scriptures/${scripture.slug}` },
  ]

  return (
    <main className="bg-brand-black min-h-screen">
      <BreadcrumbJsonLd items={breadcrumbItems} />

      {/* Scripture header */}
      <section className="pb-8 pt-24 md:pb-12 md:pt-32">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="font-sans text-3xl font-bold text-warm-white md:text-4xl">
            Sermons from {scripture.name}
          </h1>
          <p className="mt-2 text-warm-white/60">
            {sermonsResult.totalDocs}{' '}
            {sermonsResult.totalDocs === 1 ? 'sermon' : 'sermons'}
          </p>
        </div>
      </section>

      {/* Sermon list */}
      <section className="pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            {sermonsResult.docs.map((sermon) => (
              <SermonCard
                key={sermon.id}
                id={Number(sermon.id)}
                title={sermon.title}
                slug={sermon.slug}
                audioSpeaker={
                  sermon.audioSpeaker && typeof sermon.audioSpeaker === 'object' && 'name' in sermon.audioSpeaker
                    ? { name: sermon.audioSpeaker.name as string, slug: (sermon.audioSpeaker as { slug?: string }).slug ?? '' }
                    : null
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
                videos={getSermonVideos(sermon)}
                seriesBannerUrl={getSeriesBannerUrl(sermon)}
              />
            ))}
          </div>

          {sermonsResult.totalDocs === 0 && (
            <p className="py-12 text-center text-warm-white/60">
              No sermons found for this scripture.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
