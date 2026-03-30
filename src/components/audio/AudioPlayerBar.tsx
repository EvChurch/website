'use client'

import { useAudioPlayer } from './AudioPlayerProvider'
import Link from 'next/link'
import Image from 'next/image'

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

  if (!currentSermon) return null

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
    <div className="fixed inset-x-0 bottom-0 z-40 bg-brand-black shadow-2xl">
      {/* Progress bar - clickable, sits on top edge */}
      <div
        className="group relative h-1 cursor-pointer transition-all hover:h-2"
        onClick={handleProgressClick}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={duration}
      >
        <div className="absolute inset-0 bg-warm-white/30" />
        <div
          className="absolute inset-y-0 left-0 bg-rich-red after:absolute after:right-0 after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:translate-x-1/2 after:scale-0 after:rounded-full after:bg-rich-red after:shadow-md after:transition-transform group-hover:after:scale-100"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-7xl items-stretch gap-3 px-4 sm:gap-4 sm:px-6">
        {/* Banner image - full height, natural aspect ratio */}
        {currentSermon.artworkUrl && (
          <Link href={`/sermons/${currentSermon.slug}`} className="relative hidden shrink-0 sm:block">
            <Image
              src={currentSermon.artworkUrl}
              alt=""
              width={96}
              height={54}
              sizes="96px"
              className="h-full w-auto object-cover"
            />
          </Link>
        )}

        {/* Sermon info */}
        <div className="min-w-0 flex-1 py-3">
          <Link
            href={`/sermons/${currentSermon.slug}`}
            className="block truncate text-sm font-medium text-warm-white hover:underline"
          >
            {currentSermon.title}
          </Link>
          <p className="truncate text-xs text-warm-white/60">
            {currentSermon.speaker && currentSermon.speakerSlug ? (
              <Link href={`/sermons/speakers/${currentSermon.speakerSlug}`} className="hover:text-warm-white transition-colors">
                {currentSermon.speaker}
              </Link>
            ) : currentSermon.speaker ? (
              <span>{currentSermon.speaker}</span>
            ) : null}
            {currentSermon.series && (
              <>
                {currentSermon.speaker && <span> &middot; </span>}
                {currentSermon.seriesSlug ? (
                  <Link href={`/sermons/series/${currentSermon.seriesSlug}`} className="hover:text-warm-white transition-colors">
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
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Skip back */}
          <button
            onClick={skipBack}
            className="rounded-full p-1.5 text-warm-white/70 transition-colors hover:text-warm-white sm:p-2"
            aria-label="Skip back 15 seconds"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              <text x="10" y="16" fontSize="7" textAnchor="middle" fill="currentColor">
                15
              </text>
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? pause : resume}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-white text-brand-black transition-transform hover:scale-105"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={isLoading}
          >
            {isLoading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
            ) : isPlaying ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="h-5 w-5 pl-0.5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Skip forward */}
          <button
            onClick={skipForward}
            className="rounded-full p-1.5 text-warm-white/70 transition-colors hover:text-warm-white sm:p-2"
            aria-label="Skip forward 15 seconds"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
              <text x="14" y="16" fontSize="7" textAnchor="middle" fill="currentColor">
                15
              </text>
            </svg>
          </button>

          {/* Speed */}
          <button
            onClick={cycleSpeed}
            className="hidden rounded-md px-2 py-1 text-xs font-medium text-warm-white/70 transition-colors hover:text-warm-white sm:block"
            aria-label={`Playback speed ${playbackSpeed}x`}
          >
            {playbackSpeed}x
          </button>

          {/* Time */}
          <span className="hidden min-w-[80px] text-right text-xs tabular-nums text-warm-white/50 sm:block">
            {formatTime(progress)} / {formatTime(duration)}
          </span>

          {/* Close */}
          <button
            onClick={close}
            className="rounded-full p-1.5 text-warm-white/40 transition-colors hover:text-warm-white"
            aria-label="Close player"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
