import type { Metadata } from 'next'
import type { Where } from 'payload'
import { MediaImage } from '@/components/media/MediaImage'
import { getPayloadClient } from '@/lib/payload'
import { getSermonAudioUrl, getSeriesBannerUrl, getSermonVideos } from '@/lib/sermon-utils'
import { SermonCard } from '@/components/sermons/SermonCard'
import { BrowseTabs } from '@/components/sermons/BrowseTabs'
import { Suspense } from 'react'
import { SermonFilters } from '@/components/sermons/SermonFilters'
import { SermonHeroClient } from './SermonHeroClient'
import { ContinueListening } from '@/components/sermons/ContinueListening'
import { ListenedBadge } from '@/components/sermons/ListenedBadge'
import { SiApplepodcasts, SiSpotify } from 'react-icons/si'
import { HiRss } from 'react-icons/hi2'

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
    excludeFilterKey: keyof typeof activeFilterFields,
    items: { id: number; name?: string | null; title?: string | null; slug?: string | null }[],
    buildCondition: (itemId: number) => Where,
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
              buildCondition(item.id),
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
    countFor('series', seriesResult.docs as { id: number; title?: string | null; slug?: string | null }[],
      (id) => ({ series: { contains: id } })),
    countFor('speaker', speakersResult.docs as { id: number; name?: string | null; slug?: string | null }[],
      (id) => ({ or: [{ audioSpeaker: { equals: id } }, { 'videos.speaker': { equals: id } }] } as Where)),
    countFor('topic', topicsResult.docs as { id: number; name?: string | null; slug?: string | null }[],
      (id) => ({ topics: { contains: id } })),
    countFor('scripture', scripturesResult.docs as { id: number; name?: string | null; slug?: string | null }[],
      (id) => ({ scriptures: { contains: id } })),
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

  // Fetch speakers and scriptures with sermon counts for browse tabs
  const [allSpeakers, allScriptures] = await Promise.all([
    payload.find({ collection: 'speakers', sort: 'name', limit: 200, depth: 0, select: { name: true, slug: true } }),
    payload.find({ collection: 'scriptures', sort: 'name', limit: 200, depth: 0, select: { name: true, slug: true } }),
  ])

  const [speakersWithCounts, scripturesWithCounts] = await Promise.all([
    Promise.all(
      allSpeakers.docs.map(async (sp) => {
        const count = await payload.count({
          collection: 'sermons',
          where: { and: [{ isPublished: { equals: true } }, { or: [{ audioSpeaker: { equals: sp.id } }, { 'videos.speaker': { equals: sp.id } }] }] },
        })
        return { name: sp.name, slug: sp.slug, sermonCount: count.totalDocs }
      }),
    ),
    Promise.all(
      allScriptures.docs.map(async (sc) => {
        const count = await payload.count({
          collection: 'sermons',
          where: { and: [{ isPublished: { equals: true } }, { scriptures: { contains: sc.id } }] },
        })
        return { name: sc.name, slug: sc.slug, sermonCount: count.totalDocs }
      }),
    ),
  ])

  // Filter out zero-count items and sort by count descending
  const browseSpeakers = speakersWithCounts.filter((s) => s.sermonCount > 0).sort((a, b) => b.sermonCount - a.sermonCount)
  const browseScriptures = scripturesWithCounts.filter((s) => s.sermonCount > 0).sort((a, b) => b.sermonCount - a.sermonCount)

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
    if (doc.docs[0]) activeFilterFields.speaker = {
      or: [
        { audioSpeaker: { equals: doc.docs[0].id } },
        { 'videos.speaker': { equals: doc.docs[0].id } },
      ],
    }
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

    // When searching, re-sort to prioritise exact passage reference matches.
    // e.g. searching "Romans 2" should rank "Romans 2:1-16" above "Romans 12:1-8"
    if (q) {
      const normalised = q.trim().toLowerCase()
      filteredSermons.sort((a, b) => {
        const aRef = (a.passageReference ?? '').toLowerCase()
        const bRef = (b.passageReference ?? '').toLowerCase()
        const aExact = aRef.startsWith(normalised)
        const bExact = bRef.startsWith(normalised)
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        // Secondary: title match
        const aTitle = a.title.toLowerCase().includes(normalised)
        const bTitle = b.title.toLowerCase().includes(normalised)
        if (aTitle && !bTitle) return -1
        if (!aTitle && bTitle) return 1
        return 0 // preserve original -publishedAt order
      })
    }
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
  const heroAudioSpeaker = latestSermon?.audioSpeaker && typeof latestSermon.audioSpeaker === 'object' && 'name' in latestSermon.audioSpeaker
    ? latestSermon.audioSpeaker as { name: string; slug: string }
    : null
  const heroSpeakerSlug = heroAudioSpeaker?.slug
  const heroSpeakers = heroAudioSpeaker ? [heroAudioSpeaker.name] : []
  const heroSeriesTitle = heroSeriesDoc?.title
  const heroSeriesSlug = heroSeriesDoc?.slug
  const heroPassageReference = latestSermon?.passageReference ?? null
  const heroScriptures = latestSermon && Array.isArray(latestSermon.scriptures)
    ? latestSermon.scriptures
        .map((s) =>
          typeof s === 'object' && s !== null && 'name' in s
            ? { name: s.name as string, slug: (s as { slug?: string }).slug ?? '' }
            : null,
        )
        .filter((s): s is { name: string; slug: string } => s !== null)
    : []
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
                  {heroSeriesTitle && heroSeriesSlug && (
                    <a href={`/sermons/series/${heroSeriesSlug}`} className="text-warm-white/80 hover:text-warm-white transition-colors">
                      {heroSeriesTitle}
                    </a>
                  )}
                  {heroPassageReference && heroScriptures.length > 0 ? (
                    <>
                      {heroSeriesTitle && <span className="text-warm-white/30" aria-hidden="true">&middot;</span>}
                      <a href={`/sermons/scriptures/${heroScriptures[0].slug}`} className="text-warm-white/80 hover:text-warm-white transition-colors">
                        {heroPassageReference}
                      </a>
                    </>
                  ) : heroPassageReference ? (
                    <>
                      {heroSeriesTitle && <span className="text-warm-white/30" aria-hidden="true">&middot;</span>}
                      <span>{heroPassageReference}</span>
                    </>
                  ) : heroScriptures.length > 0 ? (
                    <>
                      {heroSeriesTitle && <span className="text-warm-white/30" aria-hidden="true">&middot;</span>}
                      <span>
                        {heroScriptures.map((s, i) => (
                          <span key={s.slug}>
                            {i > 0 && ', '}
                            <a href={`/sermons/scriptures/${s.slug}`} className="text-warm-white/80 hover:text-warm-white transition-colors">
                              {s.name}
                            </a>
                          </span>
                        ))}
                      </span>
                    </>
                  ) : null}
                  {(heroSeriesTitle || heroPassageReference || heroScriptures.length > 0) && heroDate && (
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
                    artworkBlurDataURL={heroBannerMedia?.blurDataURL ?? undefined}
                    duration={latestSermon.duration ?? undefined}
                    videos={getSermonVideos(latestSermon)}
                    passageReference={heroPassageReference ?? undefined}
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
          </div>
        </section>
      )}

      {/* Browse tabs: Series / Scripture / Preachers */}
      {!hasFilters && (
        <section className="pb-12">
          <div className="mx-auto max-w-5xl px-6">
            <BrowseTabs
              seriesItems={seriesWithCounts
                .filter((s) => s.sermonCount > 0)
                .map((s) => ({
                  id: Number(s.id),
                  title: s.title,
                  slug: s.slug,
                  bannerImage:
                    typeof s.bannerImage === 'object' &&
                    s.bannerImage !== null &&
                    'url' in s.bannerImage
                      ? { url: s.bannerImage.url as string, blurDataURL: (s.bannerImage as { blurDataURL?: string | null }).blurDataURL }
                      : null,
                  sermonCount: s.sermonCount,
                  earliestDate: s.earliestSermonDate,
                  latestDate: s.latestSermonDate,
                }))}
              scriptureItems={browseScriptures}
              speakerItems={browseSpeakers}
            />
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
              <a
                href="https://geo.itunes.apple.com/us/podcast/auckland-ev-church-sermons/id944102025?mt=2&app=itunes"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
              >
                <SiApplepodcasts className="h-6 w-6" />
                Apple Podcasts
              </a>
              <a
                href="https://open.spotify.com/show/7zhspYmybJOa54afNYEg8H?si=6hqr18IXRaKTdz_Jsnu--A"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
              >
                <SiSpotify className="h-6 w-6" />
                Spotify
              </a>
              <a
                href="/sermons/feed.xml"
                className="flex items-center gap-2.5 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
              >
                <HiRss className="h-5 w-5" />
                RSS Feed
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
