'use client'

import { useMediaPlayer, type SermonMedia, type VideoOption } from './MediaPlayerProvider'
import { useListeningStore, type MediaPreference } from '@/lib/listening-store'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface MediaPlayButtonProps {
  sermon: SermonMedia
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const dimensions = {
  sm: { px: 32, stroke: 2.5, radius: 13.5 },
  md: { px: 40, stroke: 3, radius: 17 },
  lg: { px: 56, stroke: 3, radius: 24.5 },
} as const

export function MediaPlayButton({ sermon, size = 'md', className = '' }: MediaPlayButtonProps) {
  const { currentSermon, isPlaying, isLoading, progress, duration, play, pause, resume } =
    useMediaPlayer()

  const [hydrated, setHydrated] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const chevronRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => setHydrated(true), [])

  const mediaPreference = useListeningStore((s) => s.mediaPreference)
  const setMediaPreference = useListeningStore((s) => s.setMediaPreference)

  const isCurrentSermon = currentSermon?.slug === sermon.slug
  const isCurrentlyPlaying = isCurrentSermon && isPlaying
  const isCurrentlyLoading = isCurrentSermon && isLoading

  // Progress ring
  const saved = useListeningStore((s) => hydrated ? s.history[sermon.slug] ?? null : null)
  let percent = 0
  if (isCurrentSermon && duration > 0) {
    percent = progress / duration
  } else if (saved && !saved.completed && saved.duration > 0) {
    percent = saved.progress / saved.duration
  } else if (saved?.completed) {
    percent = 1
  }

  const wasCompleted = useRef(saved?.completed ?? false)
  const [animatingComplete, setAnimatingComplete] = useState(false)
  useEffect(() => {
    if (percent >= 1 && !wasCompleted.current) {
      setAnimatingComplete(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimatingComplete(false))
      })
    }
    wasCompleted.current = percent >= 1
  }, [percent])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        chevronRef.current && !chevronRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [dropdownOpen])

  const hasVideos = sermon.videos && sermon.videos.length > 0

  const handleMainClick = () => {
    if (isCurrentSermon) {
      if (isPlaying) pause()
      else resume()
    } else {
      // play() reads mediaPreference internally
      play(sermon)
    }
  }

  const handleOptionSelect = (type: 'audio' | 'video', campusSlug?: string) => {
    setDropdownOpen(false)
    const pref: MediaPreference = type === 'audio' ? 'audio' : { type: 'video', campusSlug: campusSlug! }
    setMediaPreference(pref)
    play(sermon, type, campusSlug)
  }

  const toggleDropdown = () => {
    if (!dropdownOpen && chevronRef.current) {
      const rect = chevronRef.current.getBoundingClientRect()
      // Position above the button, clamped to viewport edges
      const vpW = window.innerWidth
      let left = rect.left + rect.width / 2
      // Clamp so dropdown doesn't go off-screen (assume ~160px wide dropdown)
      left = Math.max(90, Math.min(left, vpW - 90))
      setDropdownPos({
        top: rect.top,
        left,
      })
    }
    setDropdownOpen(!dropdownOpen)
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

  const chevronSizes = {
    sm: 'h-[32px] w-5',
    md: 'h-[40px] w-6',
    lg: 'h-[56px] w-8',
  }

  const chevronIconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* Connected button group */}
      <div className="flex items-stretch">
        {/* Main play button */}
        <button
          onClick={handleMainClick}
          className="relative flex shrink-0 cursor-pointer items-center justify-center rounded-l-full bg-brand-red text-warm-white transition-transform active:scale-95"
          style={{ width: px, height: px }}
          aria-label={
            isCurrentlyPlaying
              ? `Pause ${sermon.title}`
              : `Play ${sermon.title}`
          }
          disabled={isCurrentlyLoading}
        >
          {(percent > 0 || isCurrentlyLoading) && (
            <svg
              className={`pointer-events-none absolute inset-0 ${isCurrentlyLoading ? 'animate-spin' : ''}`}
              width={px}
              height={px}
              viewBox={`0 0 ${px} ${px}`}
            >
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="rgba(254,250,244,0.2)"
                strokeWidth={stroke}
              />
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={percent >= 1 ? '#22c55e' : '#FEFAF4'}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={isCurrentlyLoading ? circumference * 0.75 : animatingComplete ? circumference : dashOffset}
                transform={`rotate(-90 ${center} ${center})`}
                className={isCurrentlyLoading ? '' : `transition-[stroke-dashoffset,stroke] ${animatingComplete ? 'duration-0' : 'duration-700'}`}
              />
            </svg>
          )}

          {isCurrentlyPlaying ? (
            <svg className={iconSizes[size]} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className={`${iconSizes[size]} pl-0.5`} viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Chevron - always shown for consistent width */}
        <button
          ref={chevronRef}
          onClick={toggleDropdown}
          className={`flex items-center justify-center rounded-r-full border-l border-white/20 bg-brand-red text-warm-white/80 hover:text-white ${chevronSizes[size]}`}
          aria-label="Media options"
          aria-expanded={dropdownOpen}
        >
          <svg className={chevronIconSizes[size]} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Portal-rendered dropdown */}
      {dropdownOpen && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[60] -translate-x-1/2 -translate-y-full animate-[dropdownIn_0.15s_ease-out] rounded-lg border border-white/10 bg-brand-black/95 py-1 shadow-xl backdrop-blur-xl"
          style={{ top: dropdownPos.top - 8, left: dropdownPos.left }}
        >
          {/* Audio option */}
          <button
            onClick={() => handleOptionSelect('audio')}
            className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
              mediaPreference === 'audio' ? 'font-semibold text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
            </svg>
            Audio
            {mediaPreference === 'audio' && (
              <svg className="ml-auto h-3.5 w-3.5 text-rich-red" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Video options */}
          {(sermon.videos ?? []).map((v) => {
            const isSelected =
              mediaPreference !== 'audio' && mediaPreference.campusSlug === v.campusSlug
            return (
              <button
                key={v.campusSlug}
                onClick={() => handleOptionSelect('video', v.campusSlug)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                  isSelected ? 'font-semibold text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.14-.64l-3.25 1.95c-.38.22-.61.63-.61 1.07v5.74c0 .44.23.85.61 1.07l3.25 1.95A.75.75 0 0019 15.25v-10.5z" />
                </svg>
                {v.campusName}
                {isSelected && (
                  <svg className="ml-auto h-3.5 w-3.5 text-rich-red" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
