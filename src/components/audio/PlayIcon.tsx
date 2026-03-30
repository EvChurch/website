'use client'

import { useAudioPlayer } from './AudioPlayerProvider'
import { useEffect, useState } from 'react'

interface PlayIconProps {
  slug: string
  isPlaying: boolean
  isLoading: boolean
  /** px size of the icon circle */
  size?: number
}

/**
 * A small circular play/pause icon with a progress ring.
 * Designed to be embedded inside text buttons.
 */
export function PlayIcon({ slug, isPlaying, isLoading, size = 20 }: PlayIconProps) {
  const { currentSermon, progress, duration, getProgress } = useAudioPlayer()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const isCurrentSermon = currentSermon?.slug === slug
  const saved = hydrated ? getProgress(slug) : null

  let percent = 0
  if (isCurrentSermon && duration > 0) {
    percent = progress / duration
  } else if (saved && !saved.completed && saved.duration > 0) {
    percent = saved.progress / saved.duration
  } else if (saved?.completed) {
    percent = 1
  }

  const stroke = 2
  const radius = (size - stroke) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - percent)

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {/* Progress ring */}
      {percent > 0 && (
        <svg className="pointer-events-none absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(254,250,244,0.2)" strokeWidth={stroke} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={percent >= 1 ? '#22c55e' : 'currentColor'}
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
      {isLoading ? (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : isPlaying ? (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      ) : (
        <svg className="h-3 w-3 pl-px" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      )}
    </span>
  )
}
