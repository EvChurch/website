'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MediaPlayButton } from '@/components/media/MediaPlayButton'
import { type SermonMedia, type VideoOption } from '@/components/media/MediaPlayerProvider'
import { useListeningStore } from '@/lib/listening-store'
import { useEffect, useState } from 'react'

interface SermonCardProps {
  id: number | string
  title: string
  slug: string
  audioSpeaker?: { name: string; slug: string } | null
  publishedAt: string
  series: { title: string; slug: string }[]
  scriptures: { name: string; slug: string }[]
  passageReference?: string | null
  duration: number
  audioUrl: string
  videos?: VideoOption[]
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
  audioSpeaker,
  publishedAt,
  series,
  duration,
  scriptures,
  passageReference,
  audioUrl,
  videos,
  hideSeriesBadge,
  seriesBannerUrl,
}: SermonCardProps) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const isCompleted = useListeningStore((s) => s.history[slug]?.completed ?? false) && hydrated
  const mediaPreference = useListeningStore((s) => s.mediaPreference)

  // Determine the speaker and duration for the media type that will auto-play.
  // Only use mediaPreference after hydration to avoid SSR/client mismatch.
  const resolvedSpeaker = (() => {
    if (hydrated && mediaPreference !== 'audio' && videos && videos.length > 0) {
      const prefVideo = videos.find((v) => v.campusSlug === mediaPreference.campusSlug) ?? videos[0]
      if (prefVideo?.speakerName && prefVideo?.speakerSlug) {
        return { name: prefVideo.speakerName, slug: prefVideo.speakerSlug }
      }
    }
    return audioSpeaker ?? null
  })()

  const resolvedDuration = (() => {
    if (hydrated && mediaPreference !== 'audio' && videos && videos.length > 0) {
      const prefVideo = videos.find((v) => v.campusSlug === mediaPreference.campusSlug) ?? videos[0]
      if (prefVideo?.startSeconds != null && prefVideo?.endSeconds != null && prefVideo.endSeconds > prefVideo.startSeconds) {
        return prefVideo.endSeconds - prefVideo.startSeconds
      }
    }
    return duration
  })()

  const sermonMedia: SermonMedia = {
    id,
    title,
    slug,
    audioUrl,
    speaker: audioSpeaker?.name,
    speakerSlug: audioSpeaker?.slug,
    series: series[0]?.title,
    seriesSlug: series[0]?.slug,
    artworkUrl: seriesBannerUrl ?? undefined,
    duration,
    videos,
    passageReference: passageReference ?? undefined,
  }

  return (
    <div className="rounded-lg bg-brand-black p-4">
      <div className="flex items-center gap-4">
        <MediaPlayButton sermon={sermonMedia} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/sermons/${slug}`}
              className="block truncate font-semibold text-warm-white hover:text-brand-red transition-colors"
            >
              {title}
            </Link>
            {isCompleted && (
              <svg className="h-4 w-4 shrink-0 animate-fade-in text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-warm-white/70">
            {resolvedSpeaker && (
              <Link
                href={`/sermons/speakers/${resolvedSpeaker.slug}`}
                className="hover:text-warm-white transition-colors"
              >
                {resolvedSpeaker.name}
              </Link>
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

            {resolvedDuration > 0 && <span>{formatDuration(resolvedDuration)}</span>}
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
