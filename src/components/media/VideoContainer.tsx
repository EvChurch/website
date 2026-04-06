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

  // Track positions for both states
  const [thumbRect, setThumbRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [, setResizeTick] = useState(0)

  const updatePositions = useCallback(() => {
    const el = videoThumbnailRef?.current
    if (el) {
      const rect = el.getBoundingClientRect()
      setThumbRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    }
    setResizeTick((t) => t + 1)
  }, [videoThumbnailRef])

  // Update thumbnail position on expand/minimize, resize, and after bar animation
  useEffect(() => {
    updatePositions()
    // Re-measure after the bar's slide-in animation completes
    const delayed = setTimeout(updatePositions, 350)
    window.addEventListener('resize', updatePositions)
    return () => {
      clearTimeout(delayed)
      window.removeEventListener('resize', updatePositions)
    }
  }, [updatePositions, isVideoExpanded, isVideoVisible])

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

  // Compute both positions as inline styles so CSS transitions work
  const padding = typeof window !== 'undefined' && window.innerWidth >= 768 ? 48 : 16
  const barHeight = 100 // bottom bar + its padding
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 768
  const availW = vpW - padding * 2
  const availH = vpH - padding - barHeight // top padding + reserve space for bar
  // 16:9 constrained to available space
  let expW = availW
  let expH = expW * 9 / 16
  if (expH > availH) {
    expH = availH
    expW = expH * 16 / 9
  }
  const expTop = (vpH - barHeight - expH) / 2
  const expLeft = (vpW - expW) / 2

  const expandedStyle: React.CSSProperties = {
    top: expTop,
    left: expLeft,
    width: expW,
    height: expH,
  }

  const minimizedStyle: React.CSSProperties = thumbRect
    ? { top: thumbRect.top, left: thumbRect.left, width: thumbRect.width, height: thumbRect.height }
    : { top: vpH - 70, right: 16, width: 85, height: 48 }

  const currentStyle = isVideoExpanded ? expandedStyle : minimizedStyle

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
        Video iframe - transitions between expanded (centered 16:9)
        and minimized (bar thumbnail slot) using inline top/left/width/height.
      */}
      <div
        ref={(el) => {
          if (videoContainerRef) (videoContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        }}
        className={`fixed z-[63] overflow-hidden bg-black transition-all duration-300 ease-out ${
          isVideoExpanded ? 'rounded-xl shadow-2xl' : 'cursor-pointer rounded-lg'
        }`}
        style={currentStyle}
        onClick={isVideoExpanded ? undefined : expandVideo}
      >
        <div
          className="relative h-full w-full"
          onClick={isVideoExpanded ? undefined : expandVideo}
        >
          {/* video.js mount point */}
          <div
            ref={videoElRef}
            className="h-full w-full [&_.video-js]:!block [&_.video-js]:!h-full [&_.video-js]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full [&_.vjs-loading-spinner]:!hidden [&_.vjs-big-play-button]:!hidden"
          />

          {/* Click overlay to block YouTube iframe interaction + hover chevron */}
          <div
            className="group/vid absolute inset-0 z-[5]"
            onClick={(e) => {
              e.stopPropagation()
              if (isVideoExpanded) minimizeVideo()
              else expandVideo()
            }}
          >
            {/* Chevron indicator on hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/vid:bg-black/30">
              {isVideoExpanded ? (
                /* Down chevron - minimize */
                <svg className="h-8 w-8 text-white opacity-0 drop-shadow transition-opacity group-hover/vid:opacity-100" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
              ) : (
                /* Up chevron - expand */
                <svg className="h-6 w-6 text-white opacity-0 drop-shadow transition-opacity group-hover/vid:opacity-100" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
