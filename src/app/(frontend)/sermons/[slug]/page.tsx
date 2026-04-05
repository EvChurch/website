import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MediaImage } from '@/components/media/MediaImage'
import { getPayloadClient } from '@/lib/payload'
import { getSermonAudioUrl } from '@/lib/sermon-utils'
import { SermonCard } from '@/components/sermons/SermonCard'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { SermonPlayButton } from './SermonPlayButton'
import { ListenedBadge } from '@/components/sermons/ListenedBadge'
import { SermonVideoPlayer } from '@/components/media/SermonVideoPlayer'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

async function getSermonBySlug(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'sermons',
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
  const sermon = await getSermonBySlug(slug)

  if (!sermon) return {}

  const speakers = Array.isArray(sermon.speakers)
    ? sermon.speakers
        .map((s) =>
          typeof s === 'object' && s !== null && 'name' in s ? (s.name as string) : null,
        )
        .filter(Boolean)
    : []

  const description = speakers.length > 0
    ? `Listen to "${sermon.title}" by ${speakers.join(', ')} from Ev Church Auckland.`
    : `Listen to "${sermon.title}" from Ev Church Auckland.`

  return {
    title: `${sermon.title} | Sermons | Ev Church`,
    description,
    openGraph: {
      title: `${sermon.title} | Sermons | Ev Church`,
      description,
      url: `https://ev.church/sermons/${sermon.slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'article',
      ...((() => {
        const s = Array.isArray(sermon.series) && sermon.series[0] ? sermon.series[0] : null
        const bi = s && typeof s === 'object' && 'bannerImage' in s ? s.bannerImage : null
        const url = bi && typeof bi === 'object' && bi !== null && 'url' in bi ? (bi as { url: string }).url : null
        return url ? { images: [{ url }] } : {}
      })()),
    },
    alternates: {
      canonical: `https://ev.church/sermons/${sermon.slug}`,
    },
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Extract the series banner image URL from a populated sermon doc */
function getSeriesBannerUrl(sermon: { series?: unknown }): string | null {
  const series = Array.isArray(sermon.series) ? sermon.series[0] : null
  if (!series || typeof series !== 'object') return null
  const s = series as Record<string, unknown>
  const banner = s.bannerImage
  if (banner && typeof banner === 'object' && banner !== null && 'url' in banner) {
    return (banner as { url: string }).url
  }
  return null
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export default async function SermonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayloadClient()
  const sermon = await getSermonBySlug(slug)

  if (!sermon) notFound()

  // Extract populated relationships
  const speakers = Array.isArray(sermon.speakers)
    ? sermon.speakers
        .map((s) =>
          typeof s === 'object' && s !== null && 'name' in s
            ? { name: s.name as string, slug: (s as { slug?: string }).slug ?? '' }
            : null,
        )
        .filter((s): s is { name: string; slug: string } => s !== null)
    : []

  const seriesList = Array.isArray(sermon.series)
    ? sermon.series
        .map((s) =>
          typeof s === 'object' && s !== null && 'title' in s
            ? {
                id: (s as { id: number }).id,
                title: s.title as string,
                slug: (s as { slug?: string }).slug ?? '',
              }
            : null,
        )
        .filter((s): s is { id: number; title: string; slug: string } => s !== null)
    : []

  // Fetch the series doc with images (depth: 1 to populate Media relations)
  const seriesDoc = seriesList[0]
    ? await payload.findByID({ collection: 'sermon-series', id: seriesList[0].id, depth: 1 })
    : null
  type MediaObj = { url: string; alt?: string; blurDataURL?: string | null }
  const seriesBackgroundMedia =
    seriesDoc?.backgroundImage && typeof seriesDoc.backgroundImage === 'object' && 'url' in seriesDoc.backgroundImage
      ? (seriesDoc.backgroundImage as MediaObj) : null
  const seriesBannerMedia =
    seriesDoc?.bannerImage && typeof seriesDoc.bannerImage === 'object' && 'url' in seriesDoc.bannerImage
      ? (seriesDoc.bannerImage as MediaObj) : null
  const seriesBannerUrl = seriesBannerMedia?.url ?? null

  const scripturesList = Array.isArray(sermon.scriptures)
    ? sermon.scriptures
        .map((s) =>
          typeof s === 'object' && s !== null && 'name' in s
            ? { name: s.name as string, slug: (s as { slug?: string }).slug ?? '' }
            : null,
        )
        .filter((s): s is { name: string; slug: string } => s !== null)
    : []

  const topicsList = Array.isArray(sermon.topics)
    ? sermon.topics
        .map((t) =>
          typeof t === 'object' && t !== null && 'name' in t
            ? { name: t.name as string, slug: (t as { slug?: string }).slug ?? '' }
            : null,
        )
        .filter((t): t is { name: string; slug: string } => t !== null)
    : []

  // Extract video references for the video player
  const videoSources = Array.isArray(sermon.videos)
    ? sermon.videos
        .map((v) => {
          if (typeof v !== 'object' || v === null) return null
          const vid = v as Record<string, unknown>
          const campus = vid.campus
          const campusName =
            typeof campus === 'object' && campus !== null && 'name' in campus
              ? (campus as { name: string }).name
              : 'Watch'
          const youtubeVideoId = vid.youtubeVideoId as string | undefined
          if (!youtubeVideoId) return null
          return {
            campusName,
            youtubeVideoId,
            startSeconds: (vid.startSeconds as number) ?? sermon.sermonStartSeconds ?? undefined,
            endSeconds: (vid.endSeconds as number) ?? sermon.sermonEndSeconds ?? undefined,
          }
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
    : []

  // Extract blog post cross-link
  const blogPostLink =
    sermon.blogPost && typeof sermon.blogPost === 'object' && 'slug' in sermon.blogPost
      ? (sermon.blogPost as { slug: string }).slug
      : null

  // Fetch next/prev sermon in same series
  let prevSermon: { title: string; slug: string } | null = null
  let nextSermon: { title: string; slug: string } | null = null

  if (seriesList.length > 0 && sermon.publishedAt) {
    const [prevResult, nextResult] = await Promise.all([
      payload.find({
        collection: 'sermons',
        where: {
          and: [
            { isPublished: { equals: true } },
            { series: { contains: seriesList[0].id } },
            { publishedAt: { less_than: sermon.publishedAt } },
          ],
        },
        sort: '-publishedAt',
        limit: 1,
        depth: 0,
        select: { title: true, slug: true },
      }),
      payload.find({
        collection: 'sermons',
        where: {
          and: [
            { isPublished: { equals: true } },
            { series: { contains: seriesList[0].id } },
            { publishedAt: { greater_than: sermon.publishedAt } },
          ],
        },
        sort: 'publishedAt',
        limit: 1,
        depth: 0,
        select: { title: true, slug: true },
      }),
    ])

    if (prevResult.docs[0]) {
      prevSermon = { title: prevResult.docs[0].title, slug: prevResult.docs[0].slug }
    }
    if (nextResult.docs[0]) {
      nextSermon = { title: nextResult.docs[0].title, slug: nextResult.docs[0].slug }
    }
  }

  // Fetch "More from this speaker"
  let moreBySpeaker: typeof sermon[] = []
  if (speakers.length > 0) {
    const speakerDoc = Array.isArray(sermon.speakers)
      ? sermon.speakers[0]
      : null
    const speakerId =
      typeof speakerDoc === 'object' && speakerDoc !== null && 'id' in speakerDoc
        ? (speakerDoc as { id: number }).id
        : null

    if (speakerId) {
      const moreResult = await payload.find({
        collection: 'sermons',
        where: {
          and: [
            { isPublished: { equals: true } },
            { speakers: { contains: speakerId } },
            { id: { not_equals: sermon.id } },
          ],
        },
        sort: '-publishedAt',
        limit: 3,
        depth: 2,
      })
      moreBySpeaker = moreResult.docs
    }
  }

  // Fetch "More from this scripture" (sermons sharing the same scripture book)
  let moreByScripture: typeof sermon[] = []
  let scriptureLabel = ''
  if (scripturesList.length > 0) {
    const scriptureDoc = Array.isArray(sermon.scriptures) ? sermon.scriptures[0] : null
    const scriptureId =
      typeof scriptureDoc === 'object' && scriptureDoc !== null && 'id' in scriptureDoc
        ? (scriptureDoc as { id: number }).id
        : null

    if (scriptureId) {
      scriptureLabel = scripturesList[0].name
      const moreResult = await payload.find({
        collection: 'sermons',
        where: {
          and: [
            { isPublished: { equals: true } },
            { scriptures: { contains: scriptureId } },
            { id: { not_equals: sermon.id } },
          ],
        },
        sort: '-publishedAt',
        limit: 3,
        depth: 2,
      })
      moreByScripture = moreResult.docs
    }
  }

  // Structured data
  const breadcrumbItems = [
    { name: 'Home', url: 'https://ev.church' },
    { name: 'Sermons', url: 'https://ev.church/sermons' },
    { name: sermon.title, url: `https://ev.church/sermons/${sermon.slug}` },
  ]

  const sermonJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: sermon.title,
    url: `https://ev.church/sermons/${sermon.slug}`,
    ...(sermon.publishedAt ? { datePublished: sermon.publishedAt } : {}),
    ...(speakers.length > 0
      ? {
          author: speakers.map((s) => ({
            '@type': 'Person',
            name: s.name,
          })),
        }
      : {}),
    ...(getSermonAudioUrl(sermon.audio)
      ? {
          associatedMedia: {
            '@type': 'AudioObject',
            contentUrl: getSermonAudioUrl(sermon.audio),
            ...(sermon.duration ? { duration: `PT${Math.round(sermon.duration / 60)}M` } : {}),
          },
        }
      : {}),
    publisher: {
      '@type': 'Organization',
      name: 'Ev Church',
      url: 'https://ev.church',
    },
  }

  // Use locally-downloaded series images for the hero
  const heroMedia = seriesBackgroundMedia || seriesBannerMedia
  const heroBannerMedia = seriesBannerMedia

  return (
    <main className="bg-brand-black min-h-screen">
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sermonJsonLd) }}
      />

      {/* Hero header with background image */}
      <section className="relative overflow-hidden">
        {/* Full-bleed background image */}
        {heroMedia && (
          <>
            <MediaImage
              media={heroMedia}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              priority
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
                  alt={sermon.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Text content */}
            <div className="flex-1">
              <h1 className="font-sans text-3xl font-bold text-warm-white md:text-4xl lg:text-5xl">
                {sermon.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-warm-white/60">
                {speakers.length > 0 && (
                  <span className="text-warm-white/80">
                    {speakers.map((s, i) => (
                      <span key={s.slug}>
                        {i > 0 && ', '}
                        <Link
                          href={`/sermons/speakers/${s.slug}`}
                          className="hover:text-warm-white transition-colors"
                        >
                          {s.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                )}
                {speakers.length > 0 && sermon.publishedAt && (
                  <span className="text-warm-white/30" aria-hidden="true">&middot;</span>
                )}
                {sermon.publishedAt && (
                  <span>{formatDate(sermon.publishedAt)}</span>
                )}
                {sermon.duration && sermon.duration > 0 && (
                  <>
                    <span className="text-warm-white/30" aria-hidden="true">&middot;</span>
                    <span>{formatDuration(sermon.duration)}</span>
                  </>
                )}
                <ListenedBadge slug={sermon.slug} />
              </div>

              {/* Play button */}
              {getSermonAudioUrl(sermon.audio) && (
                <div className="mt-6">
                  <SermonPlayButton
                    id={sermon.slug.length + (sermon.duration ?? 0)}
                    title={sermon.title}
                    slug={sermon.slug}
                    audioUrl={getSermonAudioUrl(sermon.audio)}
                    speaker={speakers.map((s) => s.name).join(', ') || undefined}
                    seriesTitle={seriesList[0]?.title}
                    artworkUrl={heroBannerMedia?.url ?? undefined}
                    artworkBlurDataURL={heroBannerMedia?.blurDataURL ?? undefined}
                    duration={sermon.duration ?? undefined}
                  />
                </div>
              )}

              {/* Metadata tags */}
              <div className="mt-6 flex flex-wrap gap-2">
                {sermon.passageReference && scripturesList.length > 0 ? (
                  <Link
                    href={`/sermons/scriptures/${scripturesList[0].slug}`}
                    className="rounded-full bg-warm-white/10 px-3 py-1 text-xs font-medium text-warm-white hover:bg-warm-white/20 transition-colors"
                  >
                    {sermon.passageReference}
                  </Link>
                ) : scripturesList.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/sermons/scriptures/${s.slug}`}
                    className="rounded-full bg-warm-white/10 px-3 py-1 text-xs font-medium text-warm-white hover:bg-warm-white/20 transition-colors"
                  >
                    {s.name}
                  </Link>
                ))}
                {topicsList.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/sermons/topics/${t.slug}`}
                    className="rounded-full bg-warm-white/10 px-3 py-1 text-xs font-medium text-warm-white hover:bg-warm-white/20 transition-colors"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video player section */}
      {videoSources.length > 0 && (
        <section className="border-t border-warm-white/10 py-8">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-sans text-lg font-bold text-warm-white">Watch</h2>
              {getSermonAudioUrl(sermon.audio) && (
                <span className="text-sm text-warm-white/50">or listen to the audio above</span>
              )}
            </div>
            <SermonVideoPlayer videos={videoSources} />
          </div>
        </section>
      )}

      {/* Blog post cross-link */}
      {blogPostLink && (
        <section className="border-t border-warm-white/10 py-6">
          <div className="mx-auto max-w-5xl px-6">
            <Link
              href={`/blog/${blogPostLink}`}
              className="group flex items-center gap-3 rounded-lg border border-warm-white/10 px-5 py-4 transition-all hover:border-warm-white/20 hover:bg-warm-white/5"
            >
              <svg className="h-5 w-5 shrink-0 text-warm-white/40 group-hover:text-warm-white/70" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-warm-white/80 group-hover:text-warm-white">
                Read the blog post for this sermon
              </span>
            </Link>
          </div>
        </section>
      )}

      {/* Series navigation (prev/next) */}
      {(prevSermon || nextSermon) && (
        <section className="border-t border-warm-white/10 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-4">
              {prevSermon ? (
                <Link
                  href={`/sermons/${prevSermon.slug}`}
                  className="group flex items-center gap-3 rounded-lg border border-warm-white/10 px-4 py-4 transition-colors hover:border-warm-white/25 hover:bg-warm-white/5"
                >
                  <svg className="h-5 w-5 shrink-0 text-warm-white/40 transition-transform group-hover:-translate-x-0.5 group-hover:text-warm-white/70" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium uppercase tracking-wider text-warm-white/40">
                      Previous
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-warm-white/80 group-hover:text-warm-white">
                      {prevSermon.title}
                    </span>
                  </div>
                </Link>
              ) : (
                <div />
              )}
              {nextSermon ? (
                <Link
                  href={`/sermons/${nextSermon.slug}`}
                  className="group flex items-center justify-end gap-3 rounded-lg border border-warm-white/10 px-4 py-4 text-right transition-colors hover:border-warm-white/25 hover:bg-warm-white/5"
                >
                  <div className="min-w-0">
                    <span className="block text-xs font-medium uppercase tracking-wider text-warm-white/40">
                      Next
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-warm-white/80 group-hover:text-warm-white">
                      {nextSermon.title}
                    </span>
                  </div>
                  <svg className="h-5 w-5 shrink-0 text-warm-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-warm-white/70" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </div>
        </section>
      )}

      {/* More sermons: speaker + scripture side by side */}
      {(moreBySpeaker.length > 0 || moreByScripture.length > 0) && (
        <section className="border-t border-warm-white/10 py-12">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid gap-10 lg:grid-cols-2">
              {moreBySpeaker.length > 0 && (
                <div>
                  <h2 className="mb-5 font-sans text-lg font-bold text-warm-white">
                    More from {speakers[0]?.name ?? 'this Speaker'}
                  </h2>
                  <div className="space-y-3">
                    {moreBySpeaker.map((s) => {
                      const bannerUrl = getSeriesBannerUrl(s)
                      return (
                        <Link key={s.id} href={`/sermons/${s.slug}`} className="flex items-center gap-3 rounded-lg border border-warm-white/10 p-3 transition-all hover:border-warm-white/20 hover:bg-warm-white/5 hover:shadow-lg hover:shadow-black/20">
                          {bannerUrl && (
                            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md">
                              <Image src={bannerUrl} alt="" fill sizes="80px" className="object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span
                              className="block truncate text-sm font-semibold text-warm-white"
                            >
                              {s.title}
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-warm-white/50">
                              {s.passageReference && <span>{s.passageReference}</span>}
                              {s.publishedAt && (
                                <span>
                                  {new Date(s.publishedAt).toLocaleDateString('en-NZ', {
                                    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland',
                                  })}
                                </span>
                              )}
                              {s.duration && s.duration > 0 && <span>{formatDuration(s.duration)}</span>}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {moreByScripture.length > 0 && (
                <div>
                  <h2 className="mb-5 font-sans text-lg font-bold text-warm-white">
                    More from {scriptureLabel}
                  </h2>
                  <div className="space-y-3">
                    {moreByScripture.map((s) => {
                      const bannerUrl = getSeriesBannerUrl(s)
                      return (
                        <Link key={s.id} href={`/sermons/${s.slug}`} className="flex items-center gap-3 rounded-lg border border-warm-white/10 p-3 transition-all hover:border-warm-white/20 hover:bg-warm-white/5 hover:shadow-lg hover:shadow-black/20">
                          {bannerUrl && (
                            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md">
                              <Image src={bannerUrl} alt="" fill sizes="80px" className="object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-warm-white">
                              {s.title}
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-warm-white/50">
                              {Array.isArray(s.speakers) && s.speakers.length > 0 && (
                                <span>
                                  {s.speakers
                                    .map((sp) => (typeof sp === 'object' && sp !== null && 'name' in sp ? (sp.name as string) : ''))
                                    .filter(Boolean)
                                    .join(', ')}
                                </span>
                              )}
                              {s.passageReference && <span>{s.passageReference}</span>}
                              {s.publishedAt && (
                                <span>
                                  {new Date(s.publishedAt).toLocaleDateString('en-NZ', {
                                    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland',
                                  })}
                                </span>
                              )}
                              {s.duration && s.duration > 0 && <span>{formatDuration(s.duration)}</span>}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
