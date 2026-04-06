'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useMediaPlayer } from './MediaPlayerProvider'
import { VideoControls } from './VideoControls'

// Lazy-load video.js to avoid SSR issues and reduce bundle
let videojsPromise: Promise<typeof import('video.js')> | null = null
function getVideojs() {
  if (!videojsPromise) {
    videojsPromise = Promise.all([
      import('video.js'),
      import('videojs-youtube'),
      import('video.js/dist/video-js.css'),
    ]).then(([vjs]) => vjs)
  }
  return videojsPromise
}

type VjsPlayer = import('video.js/dist/types/player').default

export function VideoContainer() {
  const {
    activeVideo,
    isVideoVisible,
    isVideoExpanded,
    isPlaying,
    isLoading,
    progress,
    duration,
    playbackSpeed,
    pause,
    resume,
    seek,
    setSpeed,
    close,
    expandVideo,
    minimizeVideo,
    registerVideoPlayer,
    videoContainerRef,
  } = useMediaPlayer()

  const videoElRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<VjsPlayer | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const prevVideoIdRef = useRef<string | null>(null)
  const pathname = usePathname()

  // Auto-minimize on route change
  useEffect(() => {
    if (isVideoExpanded) {
      minimizeVideo()
    }
    // Only trigger on pathname change, not on isVideoExpanded changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Fullscreen listener
  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFs)
    return () => document.removeEventListener('fullscreenchange', handleFs)
  }, [])

  // Initialize or switch video when activeVideo changes
  useEffect(() => {
    if (!activeVideo || !isVideoVisible) return
    if (prevVideoIdRef.current === activeVideo.youtubeVideoId) return
    prevVideoIdRef.current = activeVideo.youtubeVideoId

    const initPlayer = async () => {
      const vjs = await getVideojs()
      const videojs = vjs.default

      // Dispose previous player
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }

      const container = videoElRef.current
      if (!container) return

      // Clear any leftover DOM
      container.innerHTML = ''

      const videoEl = document.createElement('video')
      videoEl.className = 'video-js'
      container.appendChild(videoEl)

      const startSec = activeVideo.startSeconds ?? 0
      const endSec = activeVideo.endSeconds ?? 0
      const hasSegment = startSec > 0 && endSec > startSec

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
            controls: 0,
            showinfo: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            disablekb: 1,
          },
          ytControls: 0,
        },
        controls: false,
        autoplay: true,
        preload: 'auto',
        fluid: false,
        responsive: false,
      })

      playerRef.current = player

      // Apply current speed
      player.on('loadedmetadata', () => {
        const speed = playbackSpeed
        if (speed !== 1) player.playbackRate(speed)
        if (hasSegment && (player.currentTime() ?? 0) < startSec) {
          player.currentTime(startSec)
        }
        // Retry autoplay if blocked
        if (player.paused()) {
          player.play()?.catch(() => {
            player.muted(true)
            setIsMuted(true)
            player.play()?.catch(() => {})
          })
        }
      })

      // Segment enforcement via polling in the provider
      if (hasSegment) {
        const segmentDuration = endSec - startSec
        const enforceInterval = setInterval(() => {
          if (player.isDisposed()) {
            clearInterval(enforceInterval)
            return
          }
          const time = player.currentTime() ?? 0
          if (time < startSec - 1) {
            player.currentTime(startSec)
          }
          if (time >= endSec) {
            player.pause()
            player.currentTime(endSec)
            clearInterval(enforceInterval)
          }
        }, 250)

        player.on('dispose', () => clearInterval(enforceInterval))
      }

      registerVideoPlayer(player)
    }

    initPlayer()

    return () => {
      // Don't dispose here - the player persists across expand/minimize
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo?.youtubeVideoId, isVideoVisible])

  // Clean up player when video is hidden
  useEffect(() => {
    if (!isVideoVisible && playerRef.current && !playerRef.current.isDisposed()) {
      playerRef.current.dispose()
      playerRef.current = null
      prevVideoIdRef.current = null
    }
  }, [isVideoVisible])

  // Compute display progress for controls
  const startSec = activeVideo?.startSeconds ?? 0
  const endSec = activeVideo?.endSeconds ?? 0
  const hasSegment = startSec > 0 && endSec > startSec
  const segmentDuration = hasSegment ? endSec - startSec : 0

  let displayProgress = 0
  let displayElapsed = 0
  let displayDuration = duration

  if (hasSegment && duration > 0) {
    const elapsed = Math.max(0, progress - startSec)
    displayElapsed = Math.min(elapsed, segmentDuration)
    displayProgress = segmentDuration > 0 ? displayElapsed / segmentDuration : 0
    displayDuration = segmentDuration
  } else if (duration > 0) {
    displayProgress = progress / duration
    displayElapsed = progress
  }

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause()
    else resume()
  }, [isPlaying, pause, resume])

  const handleSeek = useCallback((ratio: number) => {
    if (hasSegment) {
      seek(startSec + ratio * segmentDuration)
    } else if (duration > 0) {
      seek(ratio * duration)
    }
  }, [hasSegment, startSec, segmentDuration, duration, seek])

  const handleVolumeChange = useCallback((ratio: number) => {
    setVolumeState(ratio)
    setIsMuted(ratio === 0)
    const vp = playerRef.current
    if (vp && !vp.isDisposed()) {
      vp.volume(ratio)
      vp.muted(ratio === 0)
    }
  }, [])

  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    const vp = playerRef.current
    if (vp && !vp.isDisposed()) {
      vp.muted(newMuted)
    }
  }, [isMuted])

  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  if (!isVideoVisible) return null

  return (
    <>
      {/* Dark backdrop for expanded state */}
      {isVideoExpanded && (
        <div
          className="fixed inset-0 z-[49] bg-black/70 transition-opacity duration-300"
          onClick={minimizeVideo}
        />
      )}

      {/* Video container - CSS-resized between expanded and minimized */}
      <div
        ref={(el) => {
          wrapperRef.current = el
          if (videoContainerRef) (videoContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        }}
        className={`fixed z-50 overflow-hidden rounded-xl shadow-2xl transition-all duration-300 ease-out ${
          isVideoExpanded
            ? 'inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:w-[80vw] sm:max-w-5xl sm:-translate-x-1/2'
            : 'bottom-20 right-4 h-[108px] w-48 cursor-pointer sm:bottom-24 sm:h-[135px] sm:w-60'
        }`}
        onClick={!isVideoExpanded ? expandVideo : undefined}
      >
        <div className={`relative bg-black ${isVideoExpanded ? 'aspect-video' : 'h-full w-full'}`}>
          {/* video.js mount point */}
          <div
            ref={videoElRef}
            className="h-full w-full [&_.video-js]:!block [&_.video-js]:!h-full [&_.video-js]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full [&_.vjs-loading-spinner]:!hidden [&_.vjs-big-play-button]:!hidden"
          />

          {/* Transparent click overlay to block YouTube iframe interaction */}
          {isVideoExpanded && (
            <div
              className="absolute inset-0 z-[5]"
              onClick={(e) => {
                e.stopPropagation()
                handlePlayPause()
              }}
            />
          )}

          {/* Loading spinner */}
          {isLoading && (
            <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-transparent border-t-rich-red" />
            </div>
          )}

          {/* Controls */}
          {isVideoExpanded && (
            <VideoControls
              mode="full"
              isPlaying={isPlaying}
              progress={displayProgress}
              elapsed={displayElapsed}
              displayDuration={displayDuration}
              volume={volume}
              isMuted={isMuted}
              speed={playbackSpeed}
              isFullscreen={isFullscreen}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              onSpeedChange={setSpeed}
              onFullscreen={handleFullscreen}
              onMinimize={minimizeVideo}
            />
          )}

          {/* Minimized: small play/pause overlay */}
          {!isVideoExpanded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePlayPause()
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
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
              {/* Expand hint */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  expandVideo()
                }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-black/50 text-white/80 hover:text-white"
                aria-label="Expand video"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  close()
                }}
                className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-black/50 text-white/80 hover:text-white"
                aria-label="Close video"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
