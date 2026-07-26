'use client'

import { useMediaPlayer, type SermonMedia, type VideoOption } from '@/components/media/MediaPlayerProvider'
import { useListeningStore, type MediaPreference } from '@/lib/listening-store'
import { PlayIcon } from '@/components/audio/PlayIcon'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  videos?: VideoOption[]
  passageReference?: string
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
  videos,
  passageReference,
}: Props) {
  const { currentSermon, isPlaying, isLoading, play, pause, resume } = useMediaPlayer()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const chevronRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const mediaPreference = useListeningStore((s) => s.mediaPreference)
  const setMediaPreference = useListeningStore((s) => s.setMediaPreference)

  const isThisSermon = currentSermon?.slug === slug
  const isCurrentlyPlaying = isThisSermon && isPlaying
  const isCurrentlyLoading = isThisSermon && isLoading

  const hasVideos = videos && videos.length > 0

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

  const buildSermon = (): SermonMedia => ({
    id: sermonId, title, slug, audioUrl, speaker, speakerSlug, series: seriesTitle, seriesSlug, artworkUrl, artworkBlurDataURL, duration, videos, passageReference,
  })

  const handleClick = () => {
    if (isThisSermon) {
      if (isPlaying) pause()
      else resume()
    } else {
      play(buildSermon())
    }
  }

  const handleOptionSelect = (type: 'audio' | 'video', campusSlug?: string) => {
    setDropdownOpen(false)
    const pref: MediaPreference = type === 'audio' ? 'audio' : { type: 'video', campusSlug: campusSlug! }
    setMediaPreference(pref)
    play(buildSermon(), type, campusSlug)
  }

  const toggleDropdown = () => {
    if (!dropdownOpen && chevronRef.current) {
      const rect = chevronRef.current.getBoundingClientRect()
      const vpW = window.innerWidth
      let left = rect.left + rect.width / 2
      left = Math.max(90, Math.min(left, vpW - 90))
      setDropdownPos({ top: rect.bottom, left })
    }
    setDropdownOpen(!dropdownOpen)
  }

  let label = isCurrentlyPlaying ? 'Pause' : 'Listen Now'
  if (!isCurrentlyPlaying && hasVideos && mediaPreference !== 'audio') {
    const prefCampus = videos?.find((v) => v.campusSlug === mediaPreference.campusSlug)
    if (prefCampus) label = `Watch ${prefCampus.campusName}`
  }

  return (
    <div className="group/btn inline-flex items-stretch rounded-lg border border-warm-white/20 transition-colors hover:border-warm-white/40">
      <button
        onClick={handleClick}
        disabled={isCurrentlyLoading}
        className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-bold text-warm-white/80 transition-colors group-hover/btn:text-warm-white disabled:opacity-70"
      >
        <PlayIcon slug={slug} isPlaying={isCurrentlyPlaying} isLoading={isCurrentlyLoading} size={22} />
        {label}
      </button>

      <button
        ref={chevronRef}
        onClick={toggleDropdown}
        className="flex items-center justify-center px-2 text-warm-white/40 transition-colors group-hover/btn:text-warm-white/80"
        aria-label="Media options"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {dropdownOpen && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[60] -translate-x-1/2 animate-[dropdownIn_0.15s_ease-out] rounded-lg border border-white/10 bg-brand-black/95 py-1 shadow-xl backdrop-blur-xl"
          style={{ top: dropdownPos.top + 8, left: dropdownPos.left }}
        >
          <button
            onClick={() => handleOptionSelect('audio')}
            className={`flex w-full items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm ${
              mediaPreference === 'audio' ? 'font-semibold text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
            </svg>
            Audio
          </button>
          {(videos ?? []).map((v) => (
            <button
              key={v.campusSlug}
              onClick={() => handleOptionSelect('video', v.campusSlug)}
              className={`flex w-full items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm ${
                mediaPreference !== 'audio' && mediaPreference.campusSlug === v.campusSlug ? 'font-semibold text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.14-.64l-3.25 1.95c-.38.22-.61.63-.61 1.07v5.74c0 .44.23.85.61 1.07l3.25 1.95A.75.75 0 0019 15.25v-10.5z" />
              </svg>
              {v.campusName}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
