'use client'

import { useEffect, useRef } from 'react'
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
    minimizeVideo,
    registerVideoPlayer,
    videoContainerRef,
  } = useMediaPlayer()

  const videoElRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<VjsPlayer | null>(null)
  const prevVideoIdRef = useRef<string | null>(null)
  const pathname = usePathname()

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

      // Dispose previous player
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

      // Segment enforcement
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

  // Don't render anything if no video is active
  if (!isVideoVisible) return null

  return (
    <>
      {/* Dark backdrop - only when expanded, above header */}
      {isVideoExpanded && (
        <div
          className="fixed inset-0 z-[60] bg-black/70"
          onClick={minimizeVideo}
        />
      )}

      {/*
        Video iframe container.
        - Expanded: centered overlay with the video visible.
        - Minimized: hidden off-screen but still in DOM so the iframe stays alive.
          The bar shows a static thumbnail; this element just keeps the player running.
      */}
      <div
        ref={(el) => {
          if (videoContainerRef) (videoContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        }}
        className={
          isVideoExpanded
            ? 'fixed inset-0 z-[61] flex items-center justify-center p-4 sm:p-8'
            : 'fixed -left-[9999px] top-0 h-1 w-1 overflow-hidden'
        }
        onClick={isVideoExpanded ? minimizeVideo : undefined}
      >
        <div
          className={
            isVideoExpanded
              ? 'relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl bg-black shadow-2xl'
              : 'h-1 w-1'
          }
          onClick={isVideoExpanded ? (e) => e.stopPropagation() : undefined}
        >
          {/* video.js mount point - always in DOM when video is visible */}
          <div
            ref={videoElRef}
            className={
              isVideoExpanded
                ? 'absolute inset-0 [&_.video-js]:!block [&_.video-js]:!h-full [&_.video-js]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full [&_.vjs-loading-spinner]:!hidden [&_.vjs-big-play-button]:!hidden'
                : 'h-1 w-1 overflow-hidden'
            }
          />

          {/* Click overlay to block YouTube iframe hover - expanded only */}
          {isVideoExpanded && (
            <div className="absolute inset-0 z-[5]" />
          )}
        </div>
      </div>
    </>
  )
}
