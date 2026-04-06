'use client'

import { useMediaPlayer, type SermonMedia, type VideoOption } from '@/components/media/MediaPlayerProvider'
import { useListeningStore, type MediaPreference } from '@/lib/listening-store'
import { PlayIcon } from '@/components/audio/PlayIcon'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface SermonHeroClientProps {
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
}

export function SermonHeroClient({
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
}: SermonHeroClientProps) {
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
    id: sermonId, title, slug, audioUrl, speaker, speakerSlug, series: seriesTitle, seriesSlug, artworkUrl, artworkBlurDataURL, duration, videos,
  })

  const handleClick = () => {
    if (!audioUrl && !hasVideos) return
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
      setDropdownPos({ top: rect.top, left: rect.left + rect.width / 2 })
    }
    setDropdownOpen(!dropdownOpen)
  }

  let label = isCurrentlyPlaying ? 'Pause' : 'Listen Now'
  if (!isCurrentlyPlaying && hasVideos && mediaPreference !== 'audio') {
    const prefCampus = videos?.find((v) => v.campusSlug === mediaPreference.campusSlug)
    if (prefCampus) label = `Watch ${prefCampus.campusName}`
  }

  if (!audioUrl && !hasVideos) return null

  return (
    <div className="inline-flex items-stretch">
      <button
        onClick={handleClick}
        disabled={isCurrentlyLoading}
        className={`flex cursor-pointer items-center gap-2 border border-warm-white/20 px-4 py-2.5 text-sm font-bold text-warm-white/80 transition-colors hover:border-warm-white/40 hover:text-warm-white disabled:opacity-70 ${hasVideos ? 'rounded-l-lg border-r-0' : 'rounded-lg'}`}
      >
        <PlayIcon slug={slug} isPlaying={isCurrentlyPlaying} isLoading={isCurrentlyLoading} size={22} />
        {label}
      </button>

      {hasVideos && (
        <button
          ref={chevronRef}
          onClick={toggleDropdown}
          className="flex items-center justify-center rounded-r-lg border border-l-0 border-warm-white/20 px-2 text-warm-white/40 transition-colors hover:border-warm-white/40 hover:text-warm-white/80"
          aria-label="Media options"
        >
          <div className="mr-1.5 h-5 w-px bg-warm-white/20" />
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {dropdownOpen && dropdownPos && hasVideos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[60] -translate-x-1/2 rounded-lg border border-white/10 bg-brand-black/95 py-1 shadow-xl backdrop-blur-xl"
          style={{ top: dropdownPos.top - 4, left: dropdownPos.left, transform: 'translate(-50%, -100%)' }}
        >
          <button
            onClick={() => handleOptionSelect('audio')}
            className={`flex w-full items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm ${
              mediaPreference === 'audio' ? 'font-semibold text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Audio
          </button>
          {videos!.map((v) => (
            <button
              key={v.campusSlug}
              onClick={() => handleOptionSelect('video', v.campusSlug)}
              className={`flex w-full items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm ${
                mediaPreference !== 'audio' && mediaPreference.campusSlug === v.campusSlug ? 'font-semibold text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              {v.campusName} Video
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
