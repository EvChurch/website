'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useMediaPlayer } from './MediaPlayerProvider'

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
    playbackSpeed,
    expandVideo,
    minimizeVideo,
    registerVideoPlayer,
    videoContainerRef,
    videoThumbnailRef,
  } = useMediaPlayer()

  const videoElRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<VjsPlayer | null>(null)
  const prevVideoIdRef = useRef<string | null>(null)
  const pathname = usePathname()

  // Track the thumbnail element's position for the minimized state
  const [thumbRect, setThumbRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const updateThumbRect = useCallback(() => {
    const el = videoThumbnailRef?.current
    if (el) {
      const rect = el.getBoundingClientRect()
      setThumbRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    }
  }, [videoThumbnailRef])

  // Update thumbnail position on expand/minimize and resize
  useEffect(() => {
    updateThumbRect()
    window.addEventListener('resize', updateThumbRect)
    return () => window.removeEventListener('resize', updateThumbRect)
  }, [updateThumbRect, isVideoExpanded, isVideoVisible])

  // Auto-minimize on route change
  useEffect(() => {
    if (isVideoExpanded) {
      minimizeVideo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Initialize or switch video when activeVideo changes
  useEffect(() => {
    if (!activeVideo || !isVideoVisible) return
    if (prevVideoIdRef.current === activeVideo.youtubeVideoId) return
    prevVideoIdRef.current = activeVideo.youtubeVideoId

    const initPlayer = async () => {
      const vjs = await getVideojs()
      const videojs = vjs.default

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }

      const container = videoElRef.current
      if (!container) return

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

      player.on('loadedmetadata', () => {
        const speed = playbackSpeed
        if (speed !== 1) player.playbackRate(speed)
        if (hasSegment && (player.currentTime() ?? 0) < startSec) {
          player.currentTime(startSec)
        }
        if (player.paused()) {
          player.play()?.catch(() => {
            player.muted(true)
            player.play()?.catch(() => {})
          })
        }
      })

      if (hasSegment) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo?.youtubeVideoId, isVideoVisible])

  // Clean up player when video is fully closed
  useEffect(() => {
    if (!isVideoVisible && playerRef.current && !playerRef.current.isDisposed()) {
      playerRef.current.dispose()
      playerRef.current = null
      prevVideoIdRef.current = null
    }
  }, [isVideoVisible])

  if (!isVideoVisible) return null

  // Minimized style: position exactly over the bar's thumbnail placeholder
  const minimizedStyle: React.CSSProperties = thumbRect
    ? { top: thumbRect.top, left: thumbRect.left, width: thumbRect.width, height: thumbRect.height }
    : { bottom: 22, right: 16, width: 85, height: 48 } // fallback

  return (
    <>
      {/* Dark backdrop - only when expanded */}
      <div
        className={`fixed inset-0 z-[60] bg-black/70 transition-opacity duration-300 ${
          isVideoExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={minimizeVideo}
      />

      {/*
        Video iframe - CSS transitions between:
        - Expanded: centered overlay
        - Minimized: snapped to the bar's thumbnail slot
      */}
      <div
        ref={(el) => {
          if (videoContainerRef) (videoContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        }}
        className={`fixed z-[63] overflow-hidden bg-black transition-all duration-300 ease-out ${
          isVideoExpanded
            ? 'inset-0 flex items-center justify-center rounded-none p-4 shadow-2xl sm:p-8 md:px-[10vw] md:py-12'
            : 'cursor-pointer rounded-lg'
        }`}
        style={isVideoExpanded ? undefined : minimizedStyle}
        onClick={isVideoExpanded ? minimizeVideo : expandVideo}
      >
        <div
          className={`relative ${isVideoExpanded ? 'w-full max-w-[calc((100vh-6rem)*16/9)] overflow-hidden rounded-xl' : 'h-full w-full'}`}
          style={isVideoExpanded ? { aspectRatio: '16/9' } : undefined}
          onClick={(e) => { if (isVideoExpanded) e.stopPropagation() }}
        >
          {/* video.js mount point */}
          <div
            ref={videoElRef}
            className="h-full w-full [&_.video-js]:!block [&_.video-js]:!h-full [&_.video-js]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full [&_.vjs-loading-spinner]:!hidden [&_.vjs-big-play-button]:!hidden"
          />

          {/* Click overlay to block YouTube iframe interaction */}
          <div
            className="absolute inset-0 z-[5]"
            onClick={(e) => {
              e.stopPropagation()
              if (isVideoExpanded) minimizeVideo()
              else expandVideo()
            }}
          />
        </div>
      </div>
    </>
  )
}
