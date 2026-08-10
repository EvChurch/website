'use client'

import {
  type SermonMedia,
  useMediaPlaybackControls,
} from '@/components/media/MediaPlayerProvider'
import { MediaPlayButton } from '@/components/media/MediaPlayButton'
import { PlayIcon } from '@/components/audio/PlayIcon'
import { LEADER_RESOURCE_VIDEO_SLUG } from '@/lib/members/leader-resource-media'

export function LeaderResourceVideoButton({
  media,
  className,
  label = false,
  size = 'sm',
  tone = 'red',
  variant = 'circle',
}: {
  media: SermonMedia
  className?: string
  label?: boolean
  size?: 'sm' | 'md' | 'lg'
  tone?: 'red' | 'black'
  variant?: 'circle' | 'featured' | 'action'
}) {
  const { currentSlug, isPlaying, isLoading, play, pause, resume } = useMediaPlaybackControls()
  const isCurrent = currentSlug === media.slug
  const isCurrentlyPlaying = isCurrent && isPlaying
  const isCurrentlyLoading = isCurrent && isLoading

  const handleClick = () => {
    if (isCurrent) {
      if (isPlaying) pause()
      else resume()
      return
    }

    play(media, 'video', LEADER_RESOURCE_VIDEO_SLUG)
  }

  if (variant === 'featured') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isCurrentlyLoading}
        className="group inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white bg-white px-4 py-2.5 text-sm font-bold text-rich-red transition-colors hover:bg-warm-white disabled:opacity-70"
      >
        <PlayIcon
          slug={media.slug}
          isPlaying={isCurrentlyPlaying}
          isLoading={isCurrentlyLoading}
          size={22}
        />
        {isCurrentlyPlaying ? 'Pause' : 'Play now'}
      </button>
    )
  }

  if (variant === 'action') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isCurrentlyLoading}
        className={`cursor-pointer ${className ?? ''}`}
      >
        <PlayIcon
          slug={media.slug}
          isPlaying={isCurrentlyPlaying}
          isLoading={isCurrentlyLoading}
          size={22}
        />
        {isCurrentlyPlaying ? 'Pause' : 'Play'}
      </button>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <MediaPlayButton
        sermon={media}
        size={size}
        tone={tone}
        videoOnly
        resumeAs={{ type: 'video', campusSlug: LEADER_RESOURCE_VIDEO_SLUG }}
      />
      {label && <span>{isCurrentlyPlaying ? 'Pause' : 'Play'}</span>}
    </div>
  )
}
