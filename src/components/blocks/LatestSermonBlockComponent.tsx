import { MediaImage } from '@/components/media/MediaImage'
import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { getSermonAudioUrl, getSermonVideos } from '@/lib/sermon-utils'
import { LatestSermonPlayButton } from './LatestSermonPlayButton'
import { ListenedBadge } from '@/components/sermons/ListenedBadge'

interface LatestSermonBlockProps {
  heading?: string | null
}

export async function LatestSermonBlockComponent({ heading }: LatestSermonBlockProps) {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'sermons',
    where: { isPublished: { equals: true } },
    sort: '-publishedAt',
    limit: 1,
    depth: 1,
  })

  const sermon = result.docs[0]
  if (!sermon) return null

  // Extract audio speaker info
  const audioSpeaker =
    sermon.audioSpeaker && typeof sermon.audioSpeaker === 'object' && 'name' in sermon.audioSpeaker
      ? { name: sermon.audioSpeaker.name as string, slug: (sermon.audioSpeaker as { slug?: string }).slug ?? '' }
      : null

  // Extract series info
  const series = Array.isArray(sermon.series) && sermon.series[0] && typeof sermon.series[0] === 'object'
    ? sermon.series[0] as { id: number; title: string; slug: string }
    : null

  // Fetch series with populated images
  const seriesDoc = series
    ? await payload.findByID({ collection: 'sermon-series', id: series.id, depth: 1 })
    : null

  type MediaObj = { url: string; alt?: string; blurDataURL?: string | null }

  const bannerMedia =
    seriesDoc?.bannerImage && typeof seriesDoc.bannerImage === 'object' && 'url' in seriesDoc.bannerImage
      ? (seriesDoc.bannerImage as MediaObj)
      : null

  const backgroundMedia =
    (seriesDoc?.backgroundImage && typeof seriesDoc.backgroundImage === 'object' && 'url' in seriesDoc.backgroundImage
      ? (seriesDoc.backgroundImage as MediaObj)
      : null) || bannerMedia

  const bannerUrl = bannerMedia?.url ?? null

  const audioUrl = getSermonAudioUrl(sermon.audio)

  const date = sermon.publishedAt
    ? new Date(sermon.publishedAt).toLocaleDateString('en-NZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Pacific/Auckland',
      })
    : null

  return (
    <div className="bg-warm-white">
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-2xl bg-brand-black">
        {/* Background image (desktop only) */}
        {backgroundMedia && (
          <>
            <MediaImage
              media={backgroundMedia}
              alt=""
              fill
              sizes="100vw"
              className="hidden object-cover md:block"
            />
            <div className="absolute inset-0 hidden bg-gradient-to-t from-black/80 via-black/50 to-black/30 md:block" />
          </>
        )}

        {/* Mobile: full-width banner at top */}
        {bannerMedia && (
          <Link
            href={`/sermons/${sermon.slug}`}
            className="relative block aspect-video w-full overflow-hidden md:hidden"
          >
            <MediaImage
              media={bannerMedia}
              alt={sermon.title}
              fill
              sizes="100vw"
              className="object-cover"
            />
          </Link>
        )}

        <div className="relative mx-auto max-w-5xl px-6 py-8 md:py-20">
          <div className="flex flex-col gap-8 md:flex-row md:items-end">
            {/* Banner card (desktop only) */}
            {bannerMedia && (
              <Link
                href={`/sermons/${sermon.slug}`}
                className="relative hidden aspect-video shrink-0 overflow-hidden rounded-xl shadow-2xl md:block md:w-64 lg:w-72"
              >
                <MediaImage
                  media={bannerMedia}
                  alt={sermon.title}
                  fill
                  sizes="288px"
                  className="object-cover"
                />
              </Link>
            )}

            {/* Text */}
            <div className="flex-1">
              {heading && (
                <p className="text-xs font-semibold uppercase tracking-widest text-rich-red">
                  {heading}
                </p>
              )}

              <h2 className="mt-2 font-sans text-2xl font-bold text-warm-white sm:text-3xl lg:text-4xl">
                <Link
                  href={`/sermons/${sermon.slug}`}
                  className="transition-colors hover:text-warm-white/70"
                >
                  {sermon.title}
                </Link>
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-warm-white/60">
                {audioSpeaker && (
                  <span className="text-warm-white/80">
                    <Link
                      href={`/sermons/speakers/${audioSpeaker.slug}`}
                      className="hover:text-warm-white transition-colors"
                    >
                      {audioSpeaker.name}
                    </Link>
                  </span>
                )}
                {audioSpeaker && date && (
                  <span className="text-warm-white/30" aria-hidden="true">&middot;</span>
                )}
                {date && <span>{date}</span>}
                <ListenedBadge slug={sermon.slug} />
              </div>

              {audioUrl && (
                <div className="mt-6">
                  <LatestSermonPlayButton
                    sermonId={sermon.id}
                    title={sermon.title}
                    slug={sermon.slug}
                    audioUrl={audioUrl}
                    speaker={audioSpeaker?.name}
                    speakerSlug={audioSpeaker?.slug}
                    seriesTitle={series?.title}
                    seriesSlug={series?.slug}
                    artworkUrl={bannerUrl ?? undefined}
                    artworkBlurDataURL={bannerMedia?.blurDataURL ?? undefined}
                    duration={sermon.duration ?? undefined}
                    videos={getSermonVideos(sermon)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
    </div>
  )
}
