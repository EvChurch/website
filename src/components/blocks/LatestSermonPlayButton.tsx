'use client'

import { useAudioPlayer, type SermonAudio } from '@/components/audio/AudioPlayerProvider'
import { PlayIcon } from '@/components/audio/PlayIcon'

interface Props {
  sermonId: number
  title: string
  slug: string
  audioUrl: string
  speaker?: string
  speakerSlug?: string
  seriesTitle?: string
  seriesSlug?: string
  artworkUrl?: string
  artworkBlurDataURL?: string
  duration?: number
}

export function LatestSermonPlayButton({
  sermonId,
  title,
  slug,
  audioUrl,
  speaker,
  speakerSlug,
  seriesTitle,
  seriesSlug,
  artworkUrl,
  artworkBlurDataURL,
  duration,
}: Props) {
  const { currentSermon, isPlaying, isLoading, play, pause, resume } = useAudioPlayer()

  const isThisSermon = currentSermon?.slug === slug
  const isCurrentlyPlaying = isThisSermon && isPlaying
  const isCurrentlyLoading = isThisSermon && isLoading

  const handleClick = () => {
    if (isThisSermon) {
      if (isPlaying) pause()
      else resume()
    } else {
      const sermon: SermonAudio = {
        id: sermonId,
        title,
        slug,
        audioUrl,
        speaker,
        speakerSlug,
        series: seriesTitle,
        seriesSlug,
        artworkUrl,
        artworkBlurDataURL,
        duration,
      }
      play(sermon)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isCurrentlyLoading}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-warm-white/20 px-4 py-2.5 text-sm font-bold text-warm-white/80 transition-colors hover:border-warm-white/40 hover:text-warm-white disabled:opacity-70"
    >
      <PlayIcon slug={slug} isPlaying={isCurrentlyPlaying} isLoading={isCurrentlyLoading} size={22} />
      {isCurrentlyPlaying ? 'Pause' : 'Listen Now'}
    </button>
  )
}
