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
    isPlaying,
    isClosing,
    playbackSpeed,
    pause,
    resume,
    close,
    expandVideo,
    minimizeVideo,
    registerVideoPlayer,
    videoContainerRef,
    videoThumbnailRef,
    onEndedRef,
  } = useMediaPlayer()

  const videoElRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<VjsPlayer | null>(null)
  const prevVideoIdRef = useRef<string | null>(null)
  // Use the animated close (bar slide-down) when available, otherwise raw close
  const animatedClose = useCallback(() => {
    if (onEndedRef.current) onEndedRef.current()
    else close()
  }, [close, onEndedRef])
  const closeRef = useRef(animatedClose)
  closeRef.current = animatedClose
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [minimizePhase, setMinimizePhase] = useState<'idle' | 'slide-out' | 'reposition' | 'slide-in'>('idle')
  const prevExpandedRef = useRef(isVideoExpanded)
  const [shouldRender, setShouldRender] = useState(false)
  const pathname = usePathname()

  // Keep rendered briefly after isVideoVisible goes false for close animation
  useEffect(() => {
    if (isVideoVisible) {
      setShouldRender(true)
    } else if (shouldRender) {
      const timer = setTimeout(() => setShouldRender(false), 350)
      return () => clearTimeout(timer)
    }
  }, [isVideoVisible]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Two-phase minimize animation (mobile only): slide out right, then slide in from left
  useEffect(() => {
    const wasExpanded = prevExpandedRef.current
    prevExpandedRef.current = isVideoExpanded
    const mobile = typeof window !== 'undefined' && window.innerWidth < 640
    if (wasExpanded && !isVideoExpanded && mobile) {
      setMinimizePhase('slide-out')
      const t1 = setTimeout(() => {
        // Instantly reposition off-screen left (no transition)
        setMinimizePhase('reposition')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Now animate in from left
            setMinimizePhase('slide-in')
            setTimeout(() => setMinimizePhase('idle'), 300)
          })
        })
      }, 300)
      return () => clearTimeout(t1)
    }
    if (!wasExpanded && isVideoExpanded) {
      setMinimizePhase('idle')
    }
  }, [isVideoExpanded])

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

      // Mobile browsers block unmuted autoplay. Start muted to guarantee
      // playback begins, then unmute once playing.
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

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
        muted: isMobile,
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
            // Last resort: muted autoplay
            player.muted(true)
            player.play()?.catch(() => {})
          })
        }
      })

      // Unmute after playback starts on mobile
      if (isMobile) {
        player.one('playing', () => {
          player.muted(false)
        })
      }

      if (hasSegment) {
        const enforceInterval = setInterval(() => {
          if (player.isDisposed()) {
            clearInterval(enforceInterval)
            return
          }
          // Only enforce boundaries while actively playing
          if (player.paused()) return
          const time = player.currentTime() ?? 0
          // Skip enforcement if time is 0 (YouTube briefly reports 0 during resume)
          if (time === 0) return
          if (time < startSec - 1) {
            player.currentTime(startSec)
          }
          if (time >= endSec) {
            clearInterval(enforceInterval)
            closeRef.current()
          }
        }, 250)
        player.on('dispose', () => clearInterval(enforceInterval))
      }

      player.ready(() => {
        if (!player.isDisposed()) {
          registerVideoPlayer(player)
        }
      })
    }

    initPlayer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo?.youtubeVideoId, isVideoVisible])

  // Clean up player after fade-out completes
  useEffect(() => {
    if (!shouldRender && !isVideoVisible && playerRef.current && !playerRef.current.isDisposed()) {
      playerRef.current.dispose()
      playerRef.current = null
      prevVideoIdRef.current = null
    }
  }, [shouldRender, isVideoVisible])

  if (!shouldRender) return null

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

  const isMobileView = vpW < 640

  // On mobile: half-width mini player above the bar
  // On desktop: snap to the artwork thumbnail in the bar
  const mobileMinW = vpW / 2
  const mobileMinH = mobileMinW * 9 / 16
  const minimizedStyle: React.CSSProperties = isMobileView
    ? { bottom: barHeight + 32, right: 16, width: mobileMinW, height: mobileMinH }
    : thumbRect
      ? { top: thumbRect.top, left: thumbRect.left, width: thumbRect.width, height: thumbRect.height }
      : { top: vpH - 70, right: 16, width: 85, height: 48 }

  // When closing, push down off-screen
  const closingStyle: React.CSSProperties | undefined =
    isClosing && !isVideoExpanded
      ? isMobileView
        ? { ...minimizedStyle, bottom: -mobileMinH }
        : thumbRect
          ? { ...minimizedStyle, top: (thumbRect.top ?? 0) + 100 }
          : undefined
      : undefined

  let currentStyle = closingStyle ?? (isVideoExpanded ? expandedStyle : minimizedStyle)

  // Minimize animation phases (mobile only)
  if (minimizePhase === 'slide-out') {
    currentStyle = { ...expandedStyle, transform: `translateX(${vpW}px)` }
  } else if (minimizePhase === 'reposition') {
    // Instant reposition off-screen right — transition disabled via class
    currentStyle = { ...minimizedStyle, transform: `translateX(${vpW}px)` }
  } else if (minimizePhase === 'slide-in') {
    currentStyle = { ...minimizedStyle, transform: 'translateX(0)' }
  }

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
        className={`fixed z-[63] overflow-hidden bg-black ${
          minimizePhase === 'reposition' ? '' : 'transition-all duration-300 ease-out'
        } ${
          isVideoExpanded ? 'rounded-xl shadow-2xl' : `cursor-pointer shadow-2xl ${isMobileView ? 'rounded-2xl' : 'rounded-lg'}`
        } ${isClosing && isVideoExpanded ? 'opacity-0' : 'opacity-100'}`}
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

          {/* Click overlay to block YouTube iframe interaction */}
          <div
            className="absolute inset-0 z-[5]"
            onClick={(e) => {
              e.stopPropagation()
              if (isVideoExpanded) {
                if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
                setFlashIcon(isPlaying ? 'pause' : 'play')
                flashTimerRef.current = setTimeout(() => setFlashIcon(null), 700)
                if (isPlaying) pause()
                else resume()
              } else {
                expandVideo()
              }
            }}
          />

          {/* Play/pause flash indicator */}
          {flashIcon && isVideoExpanded && (
            <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
              <div className="animate-[fadeScale_0.7s_ease-out_forwards] flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                {flashIcon === 'pause' ? (
                  <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="ml-1 h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chevron overlay — fixed position above the iframe, over the thumbnail spot */}
      {thumbRect && !isClosing && (
        <button
          className="group/chev fixed z-[64] flex items-center justify-center rounded-lg transition-colors hover:bg-black/40"
          style={{ top: thumbRect.top, left: thumbRect.left, width: thumbRect.width, height: thumbRect.height }}
          onClick={isVideoExpanded ? minimizeVideo : expandVideo}
          aria-label={isVideoExpanded ? 'Minimize video' : 'Expand video'}
        >
          <svg
            className="h-5 w-5 text-white opacity-0 drop-shadow transition-all duration-300 group-hover/chev:opacity-100 sm:opacity-0"
            style={{ transform: isVideoExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z" />
          </svg>
        </button>
      )}
    </>
  )
}
