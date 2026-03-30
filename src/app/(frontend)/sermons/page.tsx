import type { Metadata } from 'next'
import type { Where } from 'payload'
import { MediaImage } from '@/components/media/MediaImage'
import { getPayloadClient } from '@/lib/payload'
import { getSermonAudioUrl, getSeriesBannerUrl } from '@/lib/sermon-utils'
import { SermonCard } from '@/components/sermons/SermonCard'
import { SeriesCard } from '@/components/sermons/SeriesCard'
import { Suspense } from 'react'
import { SermonFilters } from '@/components/sermons/SermonFilters'
import { SermonHeroClient } from './SermonHeroClient'
import { ContinueListening } from '@/components/sermons/ContinueListening'
import { ListenedBadge } from '@/components/sermons/ListenedBadge'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Sermons',
    description:
      'Listen to sermons from Ev Church Auckland. Browse by series, speaker, topic, or scripture.',
    openGraph: {
      title: 'Sermons | Ev Church',
      description:
        'Listen to sermons from Ev Church Auckland. Browse by series, speaker, topic, or scripture.',
      url: 'https://ev.church/sermons',
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
    },
    alternates: {
      canonical: 'https://ev.church/sermons',
    },
  }
}

interface FilterOption {
  slug: string
  label: string
  count: number
}

/**
 * Build filter options with counts that reflect currently active filters.
 * Each dimension's count uses all OTHER active filters (cross-filtering),
 * so you can see how many results each option would give.
 */
async function buildFilterOptions(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  baseConditions: Where[],
  activeFilterFields: { series?: Where; speaker?: Where; topic?: Where; scripture?: Where; q?: Where },
) {
  const [seriesResult, speakersResult, topicsResult, scripturesResult] = await Promise.all([
    payload.find({
      collection: 'sermon-series',
      where: { isPublished: { equals: true } },
      sort: 'title',
      limit: 200,
      depth: 0,
      select: { title: true, slug: true },
    }),
    payload.find({
      collection: 'speakers',
      sort: 'name',
      limit: 200,
      depth: 0,
      select: { name: true, slug: true },
    }),
    payload.find({
      collection: 'topics',
      sort: 'name',
      limit: 200,
      depth: 0,
      select: { name: true, slug: true },
    }),
    payload.find({
      collection: 'scriptures',
      sort: 'name',
      limit: 200,
      depth: 0,
      select: { name: true, slug: true },
    }),
  ])

  // Count sermons for a dimension, using all OTHER active filters as base
  const countFor = async (
    field: string,
    excludeFilterKey: keyof typeof activeFilterFields,
    items: { id: number; name?: string | null; title?: string | null; slug?: string | null }[],
  ): Promise<FilterOption[]> => {
    // Build conditions from all filters EXCEPT the current dimension
    const crossConditions: Where[] = [...baseConditions]
    for (const [key, condition] of Object.entries(activeFilterFields)) {
      if (key !== excludeFilterKey && condition) {
        crossConditions.push(condition)
      }
    }

    const counts = await Promise.all(
      items.map(async (item) => {
        const result = await payload.count({
          collection: 'sermons',
          where: {
            and: [
              ...crossConditions,
              { [field]: { contains: item.id } },
            ],
          },
        })
        return {
          slug: item.slug ?? '',
          label: (item.title ?? item.name ?? '') as string,
          count: result.totalDocs,
        }
      }),
    )
    return counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count)
  }

  const [series, speakers, topics, scriptures] = await Promise.all([
    countFor('series', 'series', seriesResult.docs as { id: number; title?: string | null; slug?: string | null }[]),
    countFor('speakers', 'speaker', speakersResult.docs as { id: number; name?: string | null; slug?: string | null }[]),
    countFor('topics', 'topic', topicsResult.docs as { id: number; name?: string | null; slug?: string | null }[]),
    countFor('scriptures', 'scripture', scripturesResult.docs as { id: number; name?: string | null; slug?: string | null }[]),
  ])

  return { series, speakers, topics, scriptures }
}

interface SermonPageSearchParams {
  series?: string
  speaker?: string
  topic?: string
  scripture?: string
  q?: string
}

export default async function SermonsPage({
  searchParams,
}: {
  searchParams: Promise<SermonPageSearchParams>
}) {
  const { series, speaker, topic, scripture, q } = await searchParams
  const payload = await getPayloadClient()

  const hasFilters = !!(series || speaker || topic || scripture || q)

  // Fetch latest sermon
  const latestResult = await payload.find({
    collection: 'sermons',
    where: { isPublished: { equals: true } },
    sort: '-publishedAt',
    limit: 1,
    depth: 1,
  })
  const latestSermon = latestResult.docs[0] ?? null

  // Fetch all published series for the grid
  const allSeries = await payload.find({
    collection: 'sermon-series',
    where: { isPublished: { equals: true } },
    sort: 'title',
    limit: 200,
    depth: 1,
  })

  // Count sermons per series and find the latest sermon date for ordering
  const seriesWithCounts = await Promise.all(
    allSeries.docs.map(async (s) => {
      const sermonWhere: Where = {
        and: [
          { isPublished: { equals: true } },
          { series: { contains: s.id } },
        ],
      }
      const [count, latest, earliest] = await Promise.all([
        payload.count({ collection: 'sermons', where: sermonWhere }),
        payload.find({
          collection: 'sermons',
          where: sermonWhere,
          sort: '-publishedAt',
          limit: 1,
          depth: 0,
          select: { publishedAt: true },
        }),
        payload.find({
          collection: 'sermons',
          where: sermonWhere,
          sort: 'publishedAt',
          limit: 1,
          depth: 0,
          select: { publishedAt: true },
        }),
      ])
      return {
        ...s,
        sermonCount: count.totalDocs,
        latestSermonDate: latest.docs[0]?.publishedAt ?? '',
        earliestSermonDate: earliest.docs[0]?.publishedAt ?? '',
      }
    }),
  )

  // Sort by most recent sermon first
  seriesWithCounts.sort((a, b) => {
    if (!a.latestSermonDate && !b.latestSermonDate) return 0
    if (!a.latestSermonDate) return 1
    if (!b.latestSermonDate) return -1
    return b.latestSermonDate.localeCompare(a.latestSermonDate)
  })

  // Resolve filter slugs to IDs and build conditions
  const baseConditions: Where[] = [{ isPublished: { equals: true } }]
  const activeFilterFields: { series?: Where; speaker?: Where; topic?: Where; scripture?: Where; q?: Where } = {}

  if (series) {
    const doc = await payload.find({
      collection: 'sermon-series',
      where: { slug: { equals: series } },
      limit: 1,
      depth: 0,
    })
    if (doc.docs[0]) activeFilterFields.series = { series: { contains: doc.docs[0].id } }
  }
  if (speaker) {
    const doc = await payload.find({
      collection: 'speakers',
      where: { slug: { equals: speaker } },
      limit: 1,
      depth: 0,
    })
    if (doc.docs[0]) activeFilterFields.speaker = { speakers: { contains: doc.docs[0].id } }
  }
  if (topic) {
    const doc = await payload.find({
      collection: 'topics',
      where: { slug: { equals: topic } },
      limit: 1,
      depth: 0,
    })
    if (doc.docs[0]) activeFilterFields.topic = { topics: { contains: doc.docs[0].id } }
  }
  if (scripture) {
    const doc = await payload.find({
      collection: 'scriptures',
      where: { slug: { equals: scripture } },
      limit: 1,
      depth: 0,
    })
    if (doc.docs[0]) activeFilterFields.scripture = { scriptures: { contains: doc.docs[0].id } }
  }
  if (q) {
    activeFilterFields.q = { searchText: { like: q } }
  }

  // Build filter options with cross-filtered counts
  const filters = await buildFilterOptions(payload, baseConditions, activeFilterFields)

  // Fetch filtered sermons if filters are active
  let filteredSermons: typeof latestResult.docs = []
  if (hasFilters) {
    const allConditions: Where[] = [
      ...baseConditions,
      ...Object.values(activeFilterFields),
    ]

    const filtered = await payload.find({
      collection: 'sermons',
      where: { and: allConditions },
      sort: '-publishedAt',
      limit: 50,
      depth: 2,
    })
    filteredSermons = filtered.docs
  }

  // Fetch the series doc with populated images for the hero
  const heroSeriesRef = latestSermon && Array.isArray(latestSermon.series) && latestSermon.series[0]
    ? latestSermon.series[0]
    : null
  const heroSeriesId = heroSeriesRef && typeof heroSeriesRef === 'object' && 'id' in heroSeriesRef
    ? (heroSeriesRef as { id: number }).id
    : null
  const heroSeriesDoc = heroSeriesId
    ? await payload.findByID({ collection: 'sermon-series', id: heroSeriesId, depth: 1 })
    : null
  type MediaObj = { url: string; alt?: string; blurDataURL?: string | null }
  const heroBackgroundMedia =
    (heroSeriesDoc?.backgroundImage && typeof heroSeriesDoc.backgroundImage === 'object' && 'url' in heroSeriesDoc.backgroundImage
      ? (heroSeriesDoc.backgroundImage as MediaObj) : null)
    || (heroSeriesDoc?.bannerImage && typeof heroSeriesDoc.bannerImage === 'object' && 'url' in heroSeriesDoc.bannerImage
      ? (heroSeriesDoc.bannerImage as MediaObj) : null)
  const heroBannerMedia =
    heroSeriesDoc?.bannerImage && typeof heroSeriesDoc.bannerImage === 'object' && 'url' in heroSeriesDoc.bannerImage
      ? (heroSeriesDoc.bannerImage as MediaObj) : null
  const heroSpeakerObj = latestSermon && Array.isArray(latestSermon.speakers) && latestSermon.speakers[0]
    && typeof latestSermon.speakers[0] === 'object' && 'slug' in latestSermon.speakers[0]
    ? latestSermon.speakers[0] as { slug: string }
    : null
  const heroSpeakerSlug = heroSpeakerObj?.slug
  const heroSpeakers = latestSermon && Array.isArray(latestSermon.speakers)
    ? latestSermon.speakers
        .map((s) => (typeof s === 'object' && s !== null && 'name' in s ? (s.name as string) : ''))
        .filter(Boolean)
    : []
  const heroSeriesTitle = heroSeriesDoc?.title
  const heroSeriesSlug = heroSeriesDoc?.slug
  const heroDate = latestSermon?.publishedAt
    ? new Date(latestSermon.publishedAt).toLocaleDateString('en-NZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Pacific/Auckland',
      })
    : null

  return (
    <main className="min-h-screen bg-brand-black font-sans">
      {/* Hero -- latest sermon with background image */}
      {latestSermon && (
        <section className="relative overflow-hidden">
          {/* Full-bleed background image */}
          {heroBackgroundMedia && (
            <>
              <MediaImage
                media={heroBackgroundMedia}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
            </>
          )}

          <div className="relative mx-auto max-w-5xl px-6 pb-12 pt-20 md:pb-16 md:pt-28">
            <div className="flex flex-col gap-8 md:flex-row md:items-end">
              {/* Banner artwork card */}
              {heroBannerMedia && (
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl shadow-2xl md:w-72 lg:w-80">
                  <MediaImage
                    media={heroBannerMedia}
                    alt={latestSermon.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="object-cover"
                    priority
                  />
                </div>
              )}

              {/* Text content */}
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-rich-red">
                  Latest Sermon
                </p>

                <h1 className="mt-2 font-sans text-3xl font-bold text-warm-white sm:text-4xl lg:text-5xl">
                  <a href={`/sermons/${latestSermon.slug}`} className="hover:underline decoration-rich-red underline-offset-4">
                    {latestSermon.title}
                  </a>
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-warm-white/60">
                  {heroSpeakers.length > 0 && (
                    <span className="text-warm-white/80">{heroSpeakers.join(', ')}</span>
                  )}
                  {heroSpeakers.length > 0 && heroDate && (
                    <span className="text-warm-white/30" aria-hidden="true">&middot;</span>
                  )}
                  {heroDate && <span>{heroDate}</span>}
                  {latestSermon.duration && latestSermon.duration > 0 && (
                    <>
                      <span className="text-warm-white/30" aria-hidden="true">&middot;</span>
                      <span>{Math.round(latestSermon.duration / 60)} min</span>
                    </>
                  )}
                  <ListenedBadge slug={latestSermon.slug} />
                </div>

                <div className="mt-6">
                  <SermonHeroClient
                    sermonId={latestSermon.id}
                    title={latestSermon.title}
                    slug={latestSermon.slug}
                    audioUrl={getSermonAudioUrl(latestSermon.audio)}
                    speaker={heroSpeakers.join(', ')}
                    speakerSlug={heroSpeakerSlug}
                    seriesTitle={heroSeriesTitle}
                    seriesSlug={heroSeriesSlug}
                    artworkUrl={heroBannerMedia?.url ?? undefined}
                    duration={latestSermon.duration ?? undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Continue listening (client-side, from localStorage) */}
      {!hasFilters && <ContinueListening />}

      {/* Search and filters */}
      <section className="py-8">
        <div className="mx-auto max-w-5xl px-6">
          <Suspense fallback={null}>
            <SermonFilters
              filters={filters}
              currentSeries={series}
              currentSpeaker={speaker}
              currentTopic={topic}
              currentScripture={scripture}
              currentQuery={q}
            />
          </Suspense>
        </div>
      </section>

      {/* Filtered results */}
      {hasFilters && (
        <section className="pb-8">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-lg font-semibold text-warm-white">
                {filteredSermons.length} {filteredSermons.length === 1 ? 'result' : 'results'}
              </h2>
              <a
                href="/sermons"
                className="text-xs text-warm-white/40 hover:text-warm-white transition-colors"
              >
                Clear filters
              </a>
            </div>
            <div className="space-y-2">
              {filteredSermons.map((sermon) => (
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
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Series grid */}
      {!hasFilters && (
        <section className="pb-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-5 font-sans text-xl font-semibold text-warm-white">Browse by Series</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {seriesWithCounts
                .filter((s) => s.sermonCount > 0)
                .map((s) => (
                  <SeriesCard
                    key={s.id}
                    title={s.title}
                    slug={s.slug}
                    bannerImage={
                      typeof s.bannerImage === 'object' &&
                      s.bannerImage !== null &&
                      'url' in s.bannerImage
                        ? { url: s.bannerImage.url as string, blurDataURL: (s.bannerImage as { blurDataURL?: string | null }).blurDataURL }
                        : null
                    }
                    sermonCount={s.sermonCount}
                    earliestDate={s.earliestSermonDate}
                    latestDate={s.latestSermonDate}
                  />
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Podcast subscribe */}
      <section className="border-t border-warm-white/10 py-14">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-2xl bg-warm-white/5 px-8 py-10 text-center sm:px-12 sm:py-12">
            <h2 className="font-sans text-2xl font-bold text-warm-white sm:text-3xl">
              Take sermons with you
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-warm-white/60">
              Subscribe to the Ev Church podcast and never miss a message. New sermons every week, straight to your favourite app.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {/* Apple Podcasts */}
              <a
                href="https://geo.itunes.apple.com/us/podcast/auckland-ev-church-sermons/id944102025?mt=2&app=itunes"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0H5.34zm6.525 2.568c4.988 0 7.455 3.582 7.455 6.774 0 1.86-.945 4.17-1.665 5.186-.72 1.014-2.199 1.92-3.42 1.92-.63 0-1.17-.27-1.53-.63.18-.96.27-1.95.27-2.97 0-.18 0-.36-.015-.54.69-.135 1.215-.765 1.215-1.515 0-.855-.69-1.545-1.545-1.545a1.545 1.545 0 00-1.545 1.545c0 .75.525 1.38 1.215 1.515-.015.18-.015.36-.015.54 0 1.02.09 2.01.27 2.97-.36.36-.9.63-1.53.63-1.221 0-2.7-.906-3.42-1.92-.72-1.016-1.665-3.326-1.665-5.186 0-3.192 2.467-6.774 7.455-6.774zm-.135 3.39c-1.17 0-2.115.945-2.115 2.115 0 1.17.945 2.115 2.115 2.115 1.17 0 2.115-.945 2.115-2.115 0-1.17-.945-2.115-2.115-2.115zm0 7.02c-.63 0-1.14.51-1.14 1.14v3.39c0 1.37.51 2.49 1.14 2.49.63 0 1.14-1.12 1.14-2.49v-3.39c0-.63-.51-1.14-1.14-1.14z" />
                </svg>
                Apple Podcasts
              </a>
              {/* Spotify */}
              <a
                href="https://open.spotify.com/show/7zhspYmybJOa54afNYEg8H?si=6hqr18IXRaKTdz_Jsnu--A"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Spotify
              </a>
              {/* RSS */}
              <a
                href="/sermons/feed.xml"
                className="flex items-center gap-2.5 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.503 20.752c0 1.794-1.456 3.248-3.251 3.248-1.796 0-3.252-1.454-3.252-3.248 0-1.794 1.456-3.248 3.252-3.248 1.795 0 3.251 1.454 3.251 3.248zm-6.503-12.572v4.811c6.05.062 10.96 4.966 11.022 11.009h4.817c-.062-8.71-7.118-15.758-15.839-15.82zm0-8.18v4.819c12.951.115 23.357 10.71 23.497 23.625h4.503c-.115-15.637-12.86-28.331-28-28.444z" />
                </svg>
                RSS Feed
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
