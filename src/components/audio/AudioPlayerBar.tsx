'use client'

import { useAudioPlayer } from './AudioPlayerProvider'
import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useListeningStore } from '@/lib/listening-store'

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
    mediaType,
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
    expandVideo,
    minimizeVideo,
    isVideoExpanded,
    isVideoVisible,
    activeVideo,
    videoThumbnailRef,
    onEndedRef,
  } = useAudioPlayer()

  const isVideoMode = mediaType === 'video'

  const [show, setShow] = useState(false)
  const [render, setRender] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<{ startX: number; startY: number; currentX: number } | null>(null)

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

  // Register animated close so provider can trigger it on playback end
  useEffect(() => {
    onEndedRef.current = handleClose
    return () => { onEndedRef.current = null }
  }, [handleClose, onEndedRef])

  const [swipeX, setSwipeX] = useState(0)
  const SWIPE_THRESHOLD = 100

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only on mobile (sm breakpoint = 640px)
    if (window.innerWidth >= 640) return
    const touch = e.touches[0]
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, currentX: touch.clientX }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current) return
    const touch = e.touches[0]
    const deltaY = Math.abs(touch.clientY - swipeRef.current.startY)
    const deltaX = touch.clientX - swipeRef.current.startX
    // If vertical movement dominates, cancel swipe
    if (deltaY > 30 && Math.abs(deltaX) < deltaY) {
      swipeRef.current = null
      setSwipeX(0)
      return
    }
    swipeRef.current.currentX = touch.clientX
    setSwipeX(deltaX)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!swipeRef.current) return
    const deltaX = swipeRef.current.currentX - swipeRef.current.startX
    swipeRef.current = null
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      handleClose()
    }
    setSwipeX(0)
  }, [handleClose])

  if (!render || !currentSermon) return null

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
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
    <div className="fixed inset-x-0 bottom-0 z-[62] flex justify-center px-4 pb-4 sm:px-6 sm:pb-5">
      <div
        ref={barRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full max-w-2xl rounded-2xl border border-white/10 bg-brand-black/80 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl transition-transform duration-300 ease-out ${show ? 'translate-y-0' : 'translate-y-[calc(100%+2rem)]'}`}
        style={swipeX !== 0 ? { transform: `translateX(${swipeX}px)`, opacity: Math.max(0, 1 - Math.abs(swipeX) / (SWIPE_THRESHOLD * 2)), transition: 'opacity 0.15s' } : undefined}
      >
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          {/* Artwork + video iframe + chevron all stacked in the same spot */}
          <div ref={videoThumbnailRef as React.RefObject<HTMLDivElement | null>} className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg sm:block">
            {/* Layer 1: Series banner artwork */}
            {currentSermon.artworkUrl ? (
              isVideoMode ? (
                <Image
                  src={currentSermon.artworkUrl}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-12 w-12 object-cover"
                  {...(currentSermon.artworkBlurDataURL ? { placeholder: 'blur' as const, blurDataURL: currentSermon.artworkBlurDataURL } : {})}
                />
              ) : (
                <Link href={`/sermons/${currentSermon.slug}`}>
                  <Image
                    src={currentSermon.artworkUrl}
                    alt=""
                    width={48}
                    height={48}
                    sizes="48px"
                    className="h-12 w-12 object-cover"
                    {...(currentSermon.artworkBlurDataURL ? { placeholder: 'blur' as const, blurDataURL: currentSermon.artworkBlurDataURL } : {})}
                  />
                </Link>
              )
            ) : null}

            {/* Layer 2: video iframe lands here via CSS positioning (z-[63]) */}
            {/* Layer 3: chevron rendered as fixed element from VideoContainer */}
          </div>

          {/* Sermon info + desktop progress */}
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

            {/* Desktop seek bar + timestamps */}
            <div className="mt-2 hidden items-center gap-2 sm:flex">
              <span className="w-9 text-right text-[11px] tabular-nums text-warm-white/40">
                {formatTime(progress)}
              </span>
              <div
                className="group relative flex h-4 flex-1 cursor-pointer items-center"
                onClick={handleProgressClick}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={duration}
              >
                <div className="relative h-1 w-full rounded-full bg-white/10">
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-warm-white transition-[width] duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-warm-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  style={{ left: `${progressPercent}%`, marginLeft: '-6px' }}
                />
              </div>
              <span className="w-9 text-[11px] tabular-nums text-warm-white/40">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Skip back */}
            <button
              onClick={skipBack}
              className="relative inline-flex items-center justify-center rounded-full p-2.5 text-warm-white/60 transition-colors hover:text-warm-white sm:p-1.5"
              aria-label="Skip back 15 seconds"
            >
              <svg className="h-8 w-8 -scale-x-100 sm:h-5 sm:w-5" viewBox="0 0 18 18" fill="none">
                <path fill="currentColor" d="M1 9c0 2.21.895 4.21 2.343 5.657l1.414-1.414a6 6 0 1 1 8.956-7.956l-1.286 1.286a.25.25 0 0 0 .177.427h4.146a.25.25 0 0 0 .25-.25V2.604a.25.25 0 0 0-.427-.177l-1.438 1.438A8 8 0 0 0 1 9" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center pt-[1px] text-[11px] font-bold leading-none text-current sm:text-[7px]">15</span>
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? pause : resume}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-warm-white text-brand-black transition-transform hover:scale-105 sm:h-9 sm:w-9"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={isLoading}
            >
              {/* Loading ring */}
              {isLoading && (
                <svg className="pointer-events-none absolute h-[calc(100%+4px)] w-[calc(100%+4px)] animate-spin" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(226,42,48,0.2)" strokeWidth="2.5" />
                  <circle cx="24" cy="24" r="22" fill="none" stroke="#E22A30" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={138.2} strokeDashoffset={103.7} />
                </svg>
              )}
              {isPlaying ? (
                <svg className="h-5 w-5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="h-5 w-5 pl-0.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>

            {/* Skip forward */}
            <button
              onClick={skipForward}
              className="relative inline-flex items-center justify-center rounded-full p-2.5 text-warm-white/60 transition-colors hover:text-warm-white sm:p-1.5"
              aria-label="Skip forward 15 seconds"
            >
              <svg className="h-8 w-8 sm:h-5 sm:w-5" viewBox="0 0 18 18" fill="none">
                <path fill="currentColor" d="M1 9c0 2.21.895 4.21 2.343 5.657l1.414-1.414a6 6 0 1 1 8.956-7.956l-1.286 1.286a.25.25 0 0 0 .177.427h4.146a.25.25 0 0 0 .25-.25V2.604a.25.25 0 0 0-.427-.177l-1.438 1.438A8 8 0 0 0 1 9" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center pt-[1px] text-[11px] font-bold leading-none text-current sm:text-[7px]">15</span>
            </button>

            {/* Speed */}
            <button
              onClick={cycleSpeed}
              className="w-10 rounded-md px-1.5 py-0.5 text-center text-xs font-medium tabular-nums text-warm-white/50 transition-colors hover:text-warm-white"
              aria-label={`Playback speed ${playbackSpeed}x`}
            >
              {playbackSpeed}x
            </button>

            {/* Close (desktop only, mobile uses swipe) */}
            <button
              onClick={handleClose}
              className="hidden rounded-full p-1 text-warm-white/30 transition-colors hover:text-warm-white sm:block"
              aria-label="Close player"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile progress bar + timestamps */}
        <div className="flex items-center gap-2 px-3 pb-2.5 sm:hidden">
          <span className="w-8 text-right text-[11px] tabular-nums text-warm-white/40">
            {formatTime(progress)}
          </span>
          <div
            className="group relative flex h-4 flex-1 cursor-pointer items-center"
            onClick={handleProgressClick}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={duration}
          >
            <div className="relative h-1 w-full rounded-full bg-white/10">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-warm-white transition-[width] duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="w-8 text-[11px] tabular-nums text-warm-white/40">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
