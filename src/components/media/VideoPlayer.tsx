'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type PlayerType from 'video.js/dist/types/player'

interface VideoSource {
  campusName: string
  youtubeVideoId: string
  startSeconds?: number
  endSeconds?: number
}

interface VideoPlayerProps {
  videos: VideoSource[]
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function VideoPlayer({ videos }: VideoPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerType | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const volumeBarRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const speedMenuRef = useRef<HTMLDivElement>(null)

  const activeVideo = videos[activeIndex]

  const startSec = activeVideo?.startSeconds ?? 0
  const endSec = activeVideo?.endSeconds ?? 0
  const hasSegment = startSec > 0 && endSec > startSec
  const segmentDuration = hasSegment ? endSec - startSec : 0
  const displayDuration = hasSegment ? segmentDuration : totalDuration

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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFs)
    return () => document.removeEventListener('fullscreenchange', handleFs)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const destroyPlayer = useCallback(() => {
    stopPolling()
    if (playerRef.current) {
      playerRef.current.dispose()
      playerRef.current = null
    }
  }, [stopPolling])

  useEffect(() => {
    return () => destroyPlayer()
  }, [destroyPlayer])

  const startPolling = useCallback(() => {
    stopPolling()
    pollingRef.current = setInterval(() => {
      const player = playerRef.current
      if (!player || player.isDisposed()) return

      const time = player.currentTime() ?? 0

      if (hasSegment) {
        if (time < startSec - 1) {
          player.currentTime(startSec)
          return
        }
        if (time >= endSec) {
          player.pause()
          player.currentTime(endSec)
          setIsPlaying(false)
          setProgress(1)
          setElapsed(segmentDuration)
          stopPolling()
          return
        }
        const e = time - startSec
        setProgress(e / segmentDuration)
        setElapsed(e)
      } else {
        const dur = player.duration() ?? 0
        if (dur > 0) {
          setProgress(time / dur)
          setElapsed(time)
          setTotalDuration(dur)
        }
      }
    }, 250)
  }, [hasSegment, startSec, endSec, segmentDuration, stopPolling])

  const initPlayer = useCallback(async () => {
    if (!videoRef.current || !activeVideo) return

    setIsLoading(true)

    // Dynamically import video.js, then the YouTube plugin (must load sequentially)
    const { default: videojs } = await import('video.js')
    await import('videojs-youtube')

    const videoEl = document.createElement('video')
    videoRef.current.innerHTML = ''
    videoRef.current.appendChild(videoEl)

    const player = videojs(videoEl, {
      techOrder: ['youtube'],
      sources: [
        {
          type: 'video/youtube',
          src: `https://www.youtube.com/watch?v=${activeVideo.youtubeVideoId}`,
        },
      ],
      youtube: {
        customVars: {
          start: hasSegment ? Math.round(startSec) : undefined,
        },
      },
      controls: false,
      autoplay: true,
      preload: 'auto',
      fluid: false,
      responsive: false,
    })

    playerRef.current = player

    player.on('playing', () => {
      setIsLoading(false)
      setIsReady(true)
      setIsPlaying(true)
      startPolling()
    })

    player.on('pause', () => {
      setIsPlaying(false)
      stopPolling()
    })

    player.on('ended', () => {
      setIsPlaying(false)
      if (hasSegment) {
        setProgress(1)
        setElapsed(segmentDuration)
      }
      stopPolling()
    })

    player.on('loadedmetadata', () => {
      if (hasSegment && (player.currentTime() ?? 0) < startSec) {
        player.currentTime(startSec)
      }
      player.volume(volume)
      player.muted(isMuted)
      player.playbackRate(speed)
    })
  }, [activeVideo, hasSegment, startSec, segmentDuration, startPolling, stopPolling, volume, isMuted, speed])

  const handlePlay = useCallback(() => {
    if (!isReady) {
      initPlayer()
      return
    }

    const player = playerRef.current
    if (!player || player.isDisposed()) return

    if (isPlaying) {
      player.pause()
    } else {
      if (hasSegment && progress >= 1) {
        player.currentTime(startSec)
        setProgress(0)
        setElapsed(0)
      }
      player.play()
    }
  }, [isReady, isPlaying, hasSegment, progress, startSec, initPlayer])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || !playerRef.current) return
      const rect = progressBarRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      if (hasSegment) {
        const targetTime = startSec + ratio * segmentDuration
        playerRef.current.currentTime(targetTime)
        setProgress(ratio)
        setElapsed(ratio * segmentDuration)
      } else {
        const dur = playerRef.current.duration() ?? 0
        if (dur > 0) {
          playerRef.current.currentTime(ratio * dur)
          setProgress(ratio)
          setElapsed(ratio * dur)
        }
      }
    },
    [hasSegment, startSec, segmentDuration],
  )

  const handleVolumeChange = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!volumeBarRef.current) return
      const rect = volumeBarRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setVolume(ratio)
      setIsMuted(ratio === 0)
      const player = playerRef.current
      if (player && !player.isDisposed()) {
        player.volume(ratio)
        player.muted(ratio === 0)
      }
    },
    [],
  )

  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    const player = playerRef.current
    if (player && !player.isDisposed()) {
      player.muted(newMuted)
    }
  }, [isMuted])

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed)
    setShowSpeedMenu(false)
    const player = playerRef.current
    if (player && !player.isDisposed()) {
      player.playbackRate(newSpeed)
    }
  }, [])

  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  const handleCampusSwitch = useCallback(
    (index: number) => {
      if (index === activeIndex) return
      destroyPlayer()
      setActiveIndex(index)
      setIsLoading(false)
      setIsReady(false)
      setIsPlaying(false)
      setProgress(0)
      setElapsed(0)
      setTotalDuration(0)
    },
    [activeIndex, destroyPlayer],
  )

  if (!activeVideo) return null

  return (
    <div className="w-full">
      {/* Campus selector */}
      {videos.length > 1 && (
        <div className="mb-3 flex gap-2">
          {videos.map((video, index) => (
            <button
              key={video.youtubeVideoId}
              onClick={() => handleCampusSwitch(index)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                index === activeIndex
                  ? 'bg-rich-red text-white'
                  : 'bg-warm-white/10 text-warm-white/70 hover:bg-warm-white/20 hover:text-warm-white'
              }`}
            >
              {video.campusName}
            </button>
          ))}
        </div>
      )}

      {/* Player area */}
      <div ref={wrapperRef} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {/* Thumbnail + play button (always visible until player is ready) */}
        {!isReady && (
          <button
            onClick={handlePlay}
            disabled={isLoading}
            className="group relative h-full w-full"
          >
            <img
              src={`https://img.youtube.com/vi/${activeVideo.youtubeVideoId}/maxresdefault.jpg`}
              alt="Video thumbnail"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
              {isLoading ? (
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rich-red shadow-lg transition-transform group-hover:scale-110">
                  <svg className="ml-1 h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
            {!isLoading && (
              <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white/90">
                Watch{videos.length > 1 ? ` - ${activeVideo.campusName}` : ''}
                {displayDuration > 0 && ` (${formatTime(displayDuration)})`}
              </div>
            )}
          </button>
        )}

        {/* VideoJS container (hidden behind thumbnail until ready) */}
        {(isLoading || isReady) && (
          <div
            ref={videoRef}
            className={`absolute inset-0 [&_.video-js]:h-full [&_.video-js]:w-full ${isReady ? '' : 'invisible'}`}
          />
        )}

        {/* Custom controls overlay */}
        {isReady && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
            {/* Progress bar */}
            <div
              ref={progressBarRef}
              onClick={handleSeek}
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
                onClick={handlePlay}
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
                  onClick={handleMuteToggle}
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
                  onClick={handleVolumeChange}
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
                        onClick={() => handleSpeedChange(s)}
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

              {/* Fullscreen */}
              <button
                onClick={handleFullscreen}
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
        )}
      </div>
    </div>
  )
}
