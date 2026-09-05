import type { Metadata } from 'next'
import { trackedNotFound } from '@/lib/tracked-not-found'
import Link from 'next/link'
import Image from 'next/image'
import { MediaImage } from '@/components/media/MediaImage'
import { getPayloadMediaUrl, type PayloadMediaImage } from '@/lib/payload-media'
import { getSermonPageData } from '@/lib/sermon-pages'
import { getSeriesBannerUrl, getSermonAudioUrl, getSermonVideos } from '@/lib/sermon-utils'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { DEFAULT_OPEN_GRAPH_IMAGES, truncateMetaDescription } from '@/lib/seo-metadata'
import { SermonPlayButton } from './SermonPlayButton'
import { ListenedBadge } from '@/components/sermons/ListenedBadge'

export const revalidate = 86400

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { sermon } = await getSermonPageData(slug)

  if (!sermon) return {}

  const speakerName =
    sermon.audioSpeaker && typeof sermon.audioSpeaker === 'object' && 'name' in sermon.audioSpeaker
      ? (sermon.audioSpeaker.name as string)
      : null

  const description = truncateMetaDescription(
    speakerName
      ? `Listen to "${sermon.title}" by ${speakerName} from Ev Church Auckland. Watch or listen online and explore related Bible teaching from our sermon library.`
      : `Listen to "${sermon.title}" from Ev Church Auckland. Watch or listen online and explore related Bible teaching from our sermon library.`,
  )

  return {
    title: `${sermon.title} | Sermons`,
    description,
    openGraph: {
      title: `${sermon.title} | Sermons | Ev Church`,
      description,
      url: `https://www.ev.church/sermons/${sermon.slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'article',
      ...((() => {
        const s = Array.isArray(sermon.series) && sermon.series[0] ? sermon.series[0] : null
        const bi = s && typeof s === 'object' && 'bannerImage' in s ? s.bannerImage : null
        const url = bi && typeof bi === 'object' && bi !== null
          ? getPayloadMediaUrl(bi as PayloadMediaImage, 'large')
          : null
        return { images: url ? [{ url }] : DEFAULT_OPEN_GRAPH_IMAGES }
      })()),
    },
    alternates: {
      canonical: `https://www.ev.church/sermons/${sermon.slug}`,
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

function decodeFilename(filename: string): string {
  try {
    return decodeURIComponent(filename)
  } catch {
    return filename
  }
}

export default async function SermonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const {
    sermon,
    seriesDoc,
    prevSermon,
    nextSermon,
    moreBySeries,
  } = await getSermonPageData(slug)

  if (!sermon) trackedNotFound('sermons', slug)

  // Extract audio speaker (singular) from populated relationship
  const audioSpeaker =
    sermon.audioSpeaker && typeof sermon.audioSpeaker === 'object' && 'name' in sermon.audioSpeaker
      ? { name: sermon.audioSpeaker.name as string, slug: (sermon.audioSpeaker as { slug?: string }).slug ?? '' }
      : null

  // Collect all unique speakers across audio + video for display
  const videos = getSermonVideos(sermon)
  const allSpeakers: { name: string; slug: string }[] = []
  const seenSlugs = new Set<string>()
  if (audioSpeaker) { allSpeakers.push(audioSpeaker); seenSlugs.add(audioSpeaker.slug) }
  for (const v of videos) {
    if (v.speakerName && v.speakerSlug && !seenSlugs.has(v.speakerSlug)) {
      allSpeakers.push({ name: v.speakerName, slug: v.speakerSlug })
      seenSlugs.add(v.speakerSlug)
    }
  }

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

  const seriesBackgroundMedia =
    seriesDoc?.backgroundImage && typeof seriesDoc.backgroundImage === 'object' && 'url' in seriesDoc.backgroundImage
      ? (seriesDoc.backgroundImage as PayloadMediaImage) : null
  const seriesBannerMedia =
    seriesDoc?.bannerImage && typeof seriesDoc.bannerImage === 'object' && 'url' in seriesDoc.bannerImage
      ? (seriesDoc.bannerImage as PayloadMediaImage) : null

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

  // Extract blog post cross-link
  const blogPostLink =
    sermon.blogPost && typeof sermon.blogPost === 'object' && 'slug' in sermon.blogPost
      ? (sermon.blogPost as { slug: string }).slug
      : null

  // Render "More from this series" sermons from the same cached snapshot.
  const primarySeriesTitle = seriesList[0]?.title ?? null
  const audioUrl = getSermonAudioUrl(sermon.audio)
  const audioFilename = audioUrl.split('/').pop()
  const audioDownloadHref = audioFilename
    ? `/api/sermon-audio/stream?file=${encodeURIComponent(audioFilename)}&download=1`
    : ''

  // Structured data
  const breadcrumbItems = [
    { name: 'Home', url: 'https://www.ev.church' },
    { name: 'Sermons', url: 'https://www.ev.church/sermons' },
    { name: sermon.title, url: `https://www.ev.church/sermons/${sermon.slug}` },
  ]

  const sermonJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: sermon.title,
    url: `https://www.ev.church/sermons/${sermon.slug}`,
    ...(sermon.publishedAt ? { datePublished: sermon.publishedAt } : {}),
    ...(allSpeakers.length > 0
      ? {
          author: allSpeakers.map((s) => ({
            '@type': 'Person',
            name: s.name,
          })),
        }
      : {}),
    ...(audioUrl
      ? {
          associatedMedia: {
            '@type': 'AudioObject',
            contentUrl: audioUrl,
            ...(sermon.duration ? { duration: `PT${Math.round(sermon.duration / 60)}M` } : {}),
          },
        }
      : {}),
    publisher: {
      '@type': 'Organization',
      name: 'Ev Church',
      url: 'https://www.ev.church',
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
              mediaSize="hero"
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
                  mediaSize="medium"
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
                {allSpeakers.length > 0 && (
                  <span className="text-warm-white/80">
                    {allSpeakers.map((s, i) => (
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
                {allSpeakers.length > 0 && sermon.publishedAt && (
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
              {(audioUrl || getSermonVideos(sermon).length > 0) && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <SermonPlayButton
                    id={sermon.slug.length + (sermon.duration ?? 0)}
                    title={sermon.title}
                    slug={sermon.slug}
                    audioUrl={audioUrl}
                    speaker={allSpeakers.map((s) => s.name).join(', ') || undefined}
                    seriesTitle={seriesList[0]?.title}
                    artworkUrl={heroBannerMedia ? getPayloadMediaUrl(heroBannerMedia, 'medium') ?? undefined : undefined}
                    artworkBlurDataURL={heroBannerMedia?.blurDataURL ?? undefined}
                    duration={sermon.duration ?? undefined}
                    videos={getSermonVideos(sermon)}
                    passageReference={sermon.passageReference ?? undefined}
                  />
                  {audioDownloadHref && (
                    <a
                      href={audioDownloadHref}
                      download={audioFilename ? decodeFilename(audioFilename) : undefined}
                      aria-label={`Download sermon audio for ${sermon.title}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-warm-white/20 px-4 py-2.5 text-sm font-bold text-warm-white/80 transition-colors hover:border-warm-white/40 hover:text-warm-white"
                    >
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v7.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V2.75A.75.75 0 0110 2zM4.25 14a.75.75 0 01.75.75V16a1 1 0 001 1h8a1 1 0 001-1v-1.25a.75.75 0 011.5 0V16A2.5 2.5 0 0114 18.5H6A2.5 2.5 0 013.5 16v-1.25a.75.75 0 01.75-.75z" clipRule="evenodd" />
                      </svg>
                      Download audio
                    </a>
                  )}
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

      {/* More from this series */}
      {moreBySeries.length > 0 && (
        <section className="border-t border-warm-white/10 py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-5 font-sans text-lg font-bold text-warm-white">
              More from {primarySeriesTitle}
            </h2>
            <div className="space-y-3">
              {moreBySeries.map((s) => {
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
                        {s.audioSpeaker && typeof s.audioSpeaker === 'object' && 'name' in s.audioSpeaker && (
                          <span>{(s.audioSpeaker as { name: string }).name}</span>
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
        </section>
      )}

      {/* Browse buttons */}
      <section className="border-t border-warm-white/10 py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sermons"
              className="flex items-center gap-2 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
            >
              <svg className="h-4 w-4 text-warm-white/60" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.44A1.5 1.5 0 008.378 6H4.5z" />
              </svg>
              Browse by Series
            </Link>
            <Link
              href="/sermons#scripture"
              className="flex items-center gap-2 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
            >
              <svg className="h-4 w-4 text-warm-white/60" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.999 8.999 0 00-4.25 1.065v12.757zM9.25 4.065A8.999 8.999 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
              </svg>
              Browse by Scripture
            </Link>
            <Link
              href="/sermons#preachers"
              className="flex items-center gap-2 rounded-xl bg-warm-white/10 px-5 py-3 text-sm font-medium text-warm-white transition-all hover:-translate-y-0.5 hover:bg-warm-white/15 hover:shadow-lg hover:shadow-black/20"
            >
              <svg className="h-4 w-4 text-warm-white/60" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
              </svg>
              Browse by Preacher
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
