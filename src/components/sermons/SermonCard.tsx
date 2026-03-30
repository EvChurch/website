'use client'

import Link from 'next/link'
import Image from 'next/image'
import { PlayButton } from '@/components/audio/PlayButton'
import { useAudioPlayer, type SermonAudio } from '@/components/audio/AudioPlayerProvider'
import { useEffect, useState } from 'react'

interface SermonCardProps {
  id: number | string
  title: string
  slug: string
  speakers: { name: string; slug: string }[]
  publishedAt: string
  series: { title: string; slug: string }[]
  scriptures: { name: string; slug: string }[]
  passageReference?: string | null
  duration: number
  audioUrl: string
  hideSeriesBadge?: boolean
  seriesBannerUrl?: string | null
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return `${minutes}m`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  })
}

export function SermonCard({
  id,
  title,
  slug,
  speakers,
  publishedAt,
  series,
  duration,
  scriptures,
  passageReference,
  audioUrl,
  hideSeriesBadge,
  seriesBannerUrl,
}: SermonCardProps) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const { getProgress } = useAudioPlayer()
  const listening = hydrated ? getProgress(slug) : null
  const isCompleted = listening?.completed ?? false

  const sermonAudio: SermonAudio = {
    id,
    title,
    slug,
    audioUrl,
    speaker: speakers.map((s) => s.name).join(', ') || undefined,
    speakerSlug: speakers[0]?.slug,
    series: series[0]?.title,
    seriesSlug: series[0]?.slug,
    artworkUrl: undefined,
    duration,
  }

  return (
    <div className="rounded-lg bg-brand-black p-4">
      <div className="flex items-center gap-4">
        <PlayButton sermon={sermonAudio} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/sermons/${slug}`}
              className="block truncate font-semibold text-warm-white hover:text-brand-red transition-colors"
            >
              {title}
            </Link>
            {isCompleted && (
              <svg className="h-4 w-4 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-warm-white/70">
            {speakers.length > 0 && (
              <span>
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

            {passageReference && scriptures.length > 0 ? (
              <Link
                href={`/sermons/scriptures/${scriptures[0].slug}`}
                className="hover:text-warm-white transition-colors"
              >
                {passageReference}
              </Link>
            ) : passageReference ? (
              <span>{passageReference}</span>
            ) : scriptures.length > 0 ? (
              <span>
                {scriptures.map((s, i) => (
                  <span key={s.slug}>
                    {i > 0 && ', '}
                    <Link
                      href={`/sermons/scriptures/${s.slug}`}
                      className="hover:text-warm-white transition-colors"
                    >
                      {s.name}
                    </Link>
                  </span>
                ))}
              </span>
            ) : null}

            <span>{formatDate(publishedAt)}</span>

            {duration > 0 && <span>{formatDuration(duration)}</span>}
          </div>
        </div>

        {series.length > 0 && !hideSeriesBadge && seriesBannerUrl && (
          <Link
            href={`/sermons/series/${series[0].slug}`}
            className="relative hidden h-12 w-20 shrink-0 overflow-hidden rounded-md sm:block"
          >
            <Image src={seriesBannerUrl} alt={series[0].title} fill sizes="80px" className="object-cover" />
          </Link>
        )}
      </div>
    </div>
  )
}
