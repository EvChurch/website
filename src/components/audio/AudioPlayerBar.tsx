'use client'

import { useAudioPlayer } from './AudioPlayerProvider'
import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const

export function AudioPlayerBar() {
  const {
    currentSermon,
    isPlaying,
    isLoading,
    progress,
    duration,
    playbackSpeed,
    pause,
    resume,
    seek,
    setSpeed,
    skipForward,
    skipBack,
    close,
  } = useAudioPlayer()

  const [show, setShow] = useState(false)
  const [render, setRender] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // Open: mount then animate in on next frame
  useEffect(() => {
    if (currentSermon) {
      setRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true))
      })
    }
  }, [currentSermon])

  // Close with animation
  const handleClose = useCallback(() => {
    setShow(false)
    const el = barRef.current
    const onEnd = () => {
      el?.removeEventListener('transitionend', onEnd)
      close()
      setRender(false)
    }
    if (el) {
      el.addEventListener('transitionend', onEnd, { once: true })
      // Fallback in case transitionend doesn't fire
      setTimeout(onEnd, 350)
    } else {
      close()
      setRender(false)
    }
  }, [close])

  if (!render || !currentSermon) return null

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    seek(percent * duration)
  }

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(
      playbackSpeed as (typeof SPEED_OPTIONS)[number],
    )
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    setSpeed(SPEED_OPTIONS[nextIndex])
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:px-6 sm:pb-5">
      <div
        ref={barRef}
        className={`w-full max-w-2xl rounded-2xl border border-white/10 bg-brand-black/80 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl transition-transform duration-300 ease-out ${show ? 'translate-y-0' : 'translate-y-[calc(100%+2rem)]'}`}
      >
        {/* Progress bar - clickable, sits on top edge */}
        <div
          className="group relative h-1 cursor-pointer overflow-hidden rounded-t-2xl transition-all hover:h-1.5"
          onClick={handleProgressClick}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={duration}
        >
          <div className="absolute inset-0 bg-white/10" />
          <div
            className="absolute inset-y-0 left-0 rounded-r-full bg-rich-red after:absolute after:right-0 after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:translate-x-1/2 after:scale-0 after:rounded-full after:bg-rich-red after:shadow-md after:transition-transform group-hover:after:scale-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          {/* Banner image */}
          {currentSermon.artworkUrl && (
            <Link href={`/sermons/${currentSermon.slug}`} className="relative hidden shrink-0 overflow-hidden rounded-lg sm:block">
              <Image
                src={currentSermon.artworkUrl}
                alt=""
                width={48}
                height={48}
                sizes="48px"
                className="h-12 w-12 object-cover"
              />
            </Link>
          )}

          {/* Sermon info */}
          <div className="min-w-0 flex-1">
            <Link
              href={`/sermons/${currentSermon.slug}`}
              className="block truncate text-sm font-medium leading-tight text-warm-white hover:underline"
            >
              {currentSermon.title}
            </Link>
            <p className="truncate text-xs text-warm-white/50">
              {currentSermon.speaker && currentSermon.speakerSlug ? (
                <Link href={`/sermons/speakers/${currentSermon.speakerSlug}`} className="transition-colors hover:text-warm-white">
                  {currentSermon.speaker}
                </Link>
              ) : currentSermon.speaker ? (
                <span>{currentSermon.speaker}</span>
              ) : null}
              {currentSermon.series && (
                <>
                  {currentSermon.speaker && <span> &middot; </span>}
                  {currentSermon.seriesSlug ? (
                    <Link href={`/sermons/series/${currentSermon.seriesSlug}`} className="transition-colors hover:text-warm-white">
                      {currentSermon.series}
                    </Link>
                  ) : (
                    <span>{currentSermon.series}</span>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Skip back */}
            <button
              onClick={skipBack}
              className="rounded-full p-1.5 text-warm-white/60 transition-colors hover:text-warm-white"
              aria-label="Skip back 15 seconds"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                <text x="10" y="16" fontSize="7" textAnchor="middle" fill="currentColor">
                  15
                </text>
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? pause : resume}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-warm-white text-brand-black transition-transform hover:scale-105"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={isLoading}
            >
              {/* Loading ring */}
              {isLoading && (
                <svg className="pointer-events-none absolute inset-0 animate-spin" width={36} height={36} viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(226,42,48,0.2)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke="#E22A30" strokeWidth="3" strokeLinecap="round" strokeDasharray={100.5} strokeDashoffset={75.4} />
                </svg>
              )}
              {isPlaying ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="h-4 w-4 pl-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>

            {/* Skip forward */}
            <button
              onClick={skipForward}
              className="rounded-full p-1.5 text-warm-white/60 transition-colors hover:text-warm-white"
              aria-label="Skip forward 15 seconds"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                <text x="14" y="16" fontSize="7" textAnchor="middle" fill="currentColor">
                  15
                </text>
              </svg>
            </button>

            {/* Speed */}
            <button
              onClick={cycleSpeed}
              className="hidden rounded-md px-1.5 py-0.5 text-xs font-medium text-warm-white/50 transition-colors hover:text-warm-white sm:block"
              aria-label={`Playback speed ${playbackSpeed}x`}
            >
              {playbackSpeed}x
            </button>

            {/* Time */}
            <span className="hidden min-w-[70px] text-right text-[11px] tabular-nums text-warm-white/40 sm:block">
              {formatTime(progress)} / {formatTime(duration)}
            </span>

            {/* Close */}
            <button
              onClick={handleClose}
              className="rounded-full p-1 text-warm-white/30 transition-colors hover:text-warm-white"
              aria-label="Close player"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
