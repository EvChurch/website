import { MediaImage } from '@/components/media/MediaImage'
import type { PayloadMediaImage } from '@/lib/payload-media'
import Link from 'next/link'

interface SeriesCardProps {
  title: string
  slug: string
  bannerImage: PayloadMediaImage | null
  sermonCount: number
  earliestDate?: string
  latestDate?: string
}

function formatDateRange(earliest?: string, latest?: string): string | null {
  if (!earliest || !latest) return null
  const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }
  const from = new Date(earliest).toLocaleDateString('en-NZ', opts)
  const to = new Date(latest).toLocaleDateString('en-NZ', opts)
  return from === to ? from : `${from} - ${to}`
}

export function SeriesCard({
  title,
  slug,
  bannerImage,
  sermonCount,
  earliestDate,
  latestDate,
}: SeriesCardProps) {
  const dateRange = formatDateRange(earliestDate, latestDate)

  return (
    <Link
      href={`/sermons/series/${slug}`}
      className="group relative block aspect-video overflow-hidden rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30"
    >
      {bannerImage?.url ? (
        <MediaImage
          media={bannerImage}
          mediaSize="medium"
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red to-brand-red/70" />
      )}

      {/* Tight bottom gradient, fades out on hover */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 group-hover:opacity-0" />

      {/* Bottom text, slides down and fades on hover */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-xs font-medium text-warm-white transition-all duration-300 group-hover:translate-y-2 group-hover:opacity-0">
        <span>{sermonCount} {sermonCount === 1 ? 'sermon' : 'sermons'}</span>
        {dateRange && <span className="text-warm-white/70">{dateRange}</span>}
      </div>
    </Link>
  )
}
