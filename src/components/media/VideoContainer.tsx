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

  // Only render when video is expanded as an overlay.
  // When minimized, the AudioPlayerBar shows the thumbnail and controls.
  if (!isVideoVisible || !isVideoExpanded) return null

  return (
    <>
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 z-[49] bg-black/70"
        onClick={minimizeVideo}
      />

      {/* Expanded video overlay - fixed center */}
      <div
        ref={(el) => {
          wrapperRef.current = el
          if (videoContainerRef) (videoContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      >
        <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl bg-black shadow-2xl">
          {/* video.js mount point */}
          <div
            ref={videoElRef}
            className="absolute inset-0 [&_.video-js]:!block [&_.video-js]:!h-full [&_.video-js]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full [&_.vjs-loading-spinner]:!hidden [&_.vjs-big-play-button]:!hidden"
          />

          {/* Click overlay to block YouTube iframe interaction */}
          <div
            className="absolute inset-0 z-[5]"
            onClick={(e) => {
              e.stopPropagation()
              handlePlayPause()
            }}
          />

          {/* Loading spinner */}
          {isLoading && (
            <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-transparent border-t-rich-red" />
            </div>
          )}

          {/* Controls */}
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
        </div>
      </div>
    </>
  )
}
