'use client'

import { useAudioPlayer, type SermonAudio } from './AudioPlayerProvider'
import { useEffect, useState } from 'react'

interface PlayButtonProps {
  sermon: SermonAudio
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const dimensions = {
  sm: { px: 32, stroke: 2.5, radius: 13.5 },
  md: { px: 40, stroke: 3, radius: 17 },
  lg: { px: 56, stroke: 3, radius: 24.5 },
} as const

export function PlayButton({ sermon, size = 'md', className = '' }: PlayButtonProps) {
  const { currentSermon, isPlaying, isLoading, progress, duration, play, pause, resume, getProgress } =
    useAudioPlayer()

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const isCurrentSermon = currentSermon?.slug === sermon.slug
  const isCurrentlyPlaying = isCurrentSermon && isPlaying
  const isCurrentlyLoading = isCurrentSermon && isLoading

  // Use live progress if this sermon is active, otherwise use saved history
  const saved = hydrated ? getProgress(sermon.slug) : null
  let percent = 0
  if (isCurrentSermon && duration > 0) {
    percent = progress / duration
  } else if (saved && !saved.completed && saved.duration > 0) {
    percent = saved.progress / saved.duration
  } else if (saved?.completed) {
    percent = 1
  }

  const handleClick = () => {
    if (isCurrentSermon) {
      if (isPlaying) pause()
      else resume()
    } else {
      play(sermon)
    }
  }

  const { px, stroke, radius } = dimensions[size]
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - percent)
  const center = px / 2

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-6 w-6',
  }

  return (
    <button
      onClick={handleClick}
      className={`relative flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-red text-warm-white transition-transform hover:scale-105 active:scale-95 ${className}`}
      style={{ width: px, height: px }}
      aria-label={
        isCurrentlyPlaying
          ? `Pause ${sermon.title}`
          : `Play ${sermon.title}`
      }
      disabled={isCurrentlyLoading}
    >
      {/* Progress ring */}
      {percent > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(254,250,244,0.2)"
            strokeWidth={stroke}
          />
          {/* Fill */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={percent >= 1 ? '#22c55e' : '#FEFAF4'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
      )}

      {/* Icon */}
      {isCurrentlyLoading ? (
        <svg className={`animate-spin ${iconSizes[size]}`} viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : isCurrentlyPlaying ? (
        <svg className={iconSizes[size]} viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      ) : (
        <svg
          className={`${iconSizes[size]} pl-0.5`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <polygon points="5,3 19,12 5,21" />
        </svg>
      )}
    </button>
  )
}
