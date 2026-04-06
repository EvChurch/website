'use client'

import { useState, useRef, useEffect } from 'react'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

interface VideoControlsProps {
  mode: 'full' | 'compact'
  isPlaying: boolean
  progress: number
  elapsed: number
  displayDuration: number
  volume: number
  isMuted: boolean
  speed: number
  isFullscreen: boolean
  onPlayPause: () => void
  onSeek: (ratio: number) => void
  onVolumeChange: (ratio: number) => void
  onMuteToggle: () => void
  onSpeedChange: (speed: number) => void
  onFullscreen: () => void
  onMinimize?: () => void
}

export function VideoControls({
  mode,
  isPlaying,
  progress,
  elapsed,
  displayDuration,
  volume,
  isMuted,
  speed,
  isFullscreen,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onSpeedChange,
  onFullscreen,
  onMinimize,
}: VideoControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const volumeBarRef = useRef<HTMLDivElement>(null)
  const speedMenuRef = useRef<HTMLDivElement>(null)

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return
    const handleClick = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [showSpeedMenu])

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeBarRef.current) return
    const rect = volumeBarRef.current.getBoundingClientRect()
    onVolumeChange(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }

  if (mode === 'compact') {
    return (
      <div className="flex w-full items-center gap-2 px-2 py-1">
        <button
          onClick={onPlayPause}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-white/90 hover:text-white"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div
          ref={progressBarRef}
          onClick={handleSeekClick}
          className="h-1 flex-1 cursor-pointer rounded-full bg-white/20"
        >
          <div
            className="h-full rounded-full bg-rich-red"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-white/60">
          {formatTime(elapsed)}
        </span>
      </div>
    )
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
      {/* Progress bar */}
      <div
        ref={progressBarRef}
        onClick={handleSeekClick}
        className="group relative mb-3 h-1 cursor-pointer rounded-full bg-white/20 transition-[height] hover:h-1.5"
      >
        <div
          className="h-full rounded-full bg-rich-red"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-white/90 hover:text-white"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Volume */}
        <div className="group/vol flex shrink-0 items-center gap-1.5">
          <button
            onClick={onMuteToggle}
            className="flex h-8 w-8 items-center justify-center text-white/90 hover:text-white"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 0.5 ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
          <div
            ref={volumeBarRef}
            onClick={handleVolumeClick}
            className="hidden h-1 w-16 cursor-pointer rounded-full bg-white/20 group-hover/vol:block"
          >
            <div
              className="h-full rounded-full bg-white/80"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>

        {/* Time */}
        <span className="shrink-0 text-xs font-medium tabular-nums text-white/80">
          {formatTime(elapsed)} / {formatTime(displayDuration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Speed */}
        <div className="relative" ref={speedMenuRef}>
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="flex h-8 shrink-0 items-center rounded px-2 text-xs font-medium text-white/90 hover:text-white"
            aria-label="Playback speed"
          >
            {speed === 1 ? '1x' : `${speed}x`}
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-black/90 py-1 shadow-lg backdrop-blur">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onSpeedChange(s)
                    setShowSpeedMenu(false)
                  }}
                  className={`block w-full px-4 py-1.5 text-left text-xs ${
                    s === speed
                      ? 'font-bold text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Minimize (when in overlay) */}
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-white/90 hover:text-white"
            aria-label="Minimize video"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z" />
            </svg>
          </button>
        )}

        {/* Fullscreen */}
        <button
          onClick={onFullscreen}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-white/90 hover:text-white"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
