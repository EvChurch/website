'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useListeningStore, type MediaPreference } from '@/lib/listening-store'
import type Player from 'video.js/dist/types/player'

export interface VideoOption {
  campusName: string
  campusSlug: string
  youtubeVideoId: string
  startSeconds?: number
  endSeconds?: number
}

export interface SermonMedia {
  id: number | string
  title: string
  slug: string
  audioUrl: string
  speaker?: string
  speakerSlug?: string
  series?: string
  seriesSlug?: string
  artworkUrl?: string
  artworkBlurDataURL?: string
  duration?: number
  videos?: VideoOption[]
}

// Re-export for consumers
export type { ListeningRecord } from '@/lib/listening-store'

interface MediaPlayerState {
  currentSermon: SermonMedia | null
  mediaType: 'audio' | 'video'
  activeVideo: VideoOption | null
  isPlaying: boolean
  isLoading: boolean
  progress: number
  duration: number
  playbackSpeed: number
  isVideoExpanded: boolean
  isVideoVisible: boolean
  isClosing: boolean
  setIsClosing: (v: boolean) => void
  play: (sermon: SermonMedia, mediaType?: 'audio' | 'video', campusSlug?: string) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  skipForward: () => void
  skipBack: () => void
  close: () => void
  expandVideo: () => void
  minimizeVideo: () => void
  registerVideoPlayer: (player: Player) => void
  videoContainerRef: React.RefObject<HTMLDivElement | null>
  videoThumbnailRef: React.RefObject<HTMLElement | null>
  onEndedRef: React.MutableRefObject<(() => void) | null>
}

const MediaPlayerContext = createContext<MediaPlayerState | null>(null)

export function useMediaPlayer(): MediaPlayerState {
  const context = useContext(MediaPlayerContext)
  if (!context) {
    throw new Error('useMediaPlayer must be used within MediaPlayerProvider')
  }
  return context
}

// Backwards-compatible alias for existing audio-only consumers
export const useAudioPlayer = useMediaPlayer

const SKIP_SECONDS = 15

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoPlayerRef = useRef<Player | null>(null)
  const videoContainerRef = useRef<HTMLDivElement | null>(null)
  const videoThumbnailRef = useRef<HTMLElement | null>(null)
  const [currentSermon, setCurrentSermon] = useState<SermonMedia | null>(null)
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio')
  const [activeVideo, setActiveVideo] = useState<VideoOption | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isVideoExpanded, setIsVideoExpanded] = useState(false)
  const [isVideoVisible, setIsVideoVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const { playbackSpeed, setPlaybackSpeed, saveProgress, markCompleted, mediaPreference, setMediaPreference } =
    useListeningStore()

  const currentSlugRef = useRef<string | null>(null)
  const currentMediaTypeRef = useRef<'audio' | 'video'>('audio')
  const activeVideoRef = useRef<VideoOption | null>(null)
  const saveProgressRef = useRef<(() => void) | null>(null)
  const markCompletedRef = useRef<(() => void) | null>(null)
  const closeRef = useRef<(() => void) | null>(null)
  const onEndedRef = useRef<(() => void) | null>(null)
  const videoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const speed = useListeningStore.getState().playbackSpeed
    audio.playbackRate = speed

    const onTimeUpdate = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      setProgress(audio.currentTime)
      if (Math.floor(audio.currentTime) % 5 === 0 && audio.currentTime > 0) {
        saveProgressRef.current?.()
      }
    }
    const onDurationChange = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      setDuration(audio.duration || 0)
    }
    const onPlay = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      setIsPlaying(true)
      setIsLoading(false)
    }
    const onPause = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      setIsPlaying(false)
      saveProgressRef.current?.()
    }
    const onWaiting = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      setIsLoading(true)
    }
    const onCanPlay = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      setIsLoading(false)
    }
    const onError = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      setIsLoading(false)
    }
    const onEnded = () => {
      if (currentMediaTypeRef.current !== 'audio') return
      markCompletedRef.current?.()
      if (onEndedRef.current) {
        onEndedRef.current()
      } else {
        closeRef.current?.()
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('error', onError)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Media Session API
  useEffect(() => {
    if (!currentSermon || !('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSermon.title,
      artist: currentSermon.speaker || 'Ev Church',
      album: currentSermon.series || 'Sermons',
      artwork: currentSermon.artworkUrl
        ? [{ src: currentSermon.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })

    navigator.mediaSession.setActionHandler('play', () => {
      if (mediaType === 'audio') {
        audioRef.current?.play()
      } else {
        const vp = videoPlayerRef.current
        if (vp && !vp.isDisposed()) vp.play()
      }
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      if (mediaType === 'audio') {
        audioRef.current?.pause()
      } else {
        const vp = videoPlayerRef.current
        if (vp && !vp.isDisposed()) vp.pause()
      }
    })
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (mediaType === 'audio' && audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - SKIP_SECONDS)
      }
    })
    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (mediaType === 'audio' && audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration || 0,
          audioRef.current.currentTime + SKIP_SECONDS,
        )
      }
    })
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (mediaType === 'audio' && audioRef.current && details.seekTime != null) {
        audioRef.current.currentTime = details.seekTime
      }
    })
  }, [currentSermon, mediaType])

  // Update Media Session position state (audio only)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration || mediaType !== 'audio') return
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: playbackSpeed,
      position: Math.min(progress, duration),
    })
  }, [progress, duration, playbackSpeed, mediaType])

  // Keep refs up to date
  saveProgressRef.current = () => {
    if (!currentSermon || currentMediaTypeRef.current !== 'audio' || !audioRef.current) return
    const audio = audioRef.current
    saveProgress(
      {
        slug: currentSermon.slug,
        title: currentSermon.title,
        speaker: currentSermon.speaker,
        series: currentSermon.series,
        artworkUrl: currentSermon.artworkUrl,
        artworkBlurDataURL: currentSermon.artworkBlurDataURL,
        audioUrl: currentSermon.audioUrl,
      },
      audio.currentTime,
      audio.duration,
      currentSermon.duration,
    )
  }

  markCompletedRef.current = () => {
    if (!currentSermon) return
    markCompleted(currentSermon.slug)
  }

  // Video polling for progress
  const stopVideoPolling = useCallback(() => {
    if (videoPollingRef.current) {
      clearInterval(videoPollingRef.current)
      videoPollingRef.current = null
    }
  }, [])

  const startVideoPolling = useCallback(() => {
    stopVideoPolling()
    videoPollingRef.current = setInterval(() => {
      const player = videoPlayerRef.current
      if (!player || player.isDisposed()) return
      if (currentMediaTypeRef.current !== 'video') return

      const time = player.currentTime() ?? 0
      const vid = activeVideoRef.current
      const startSec = vid?.startSeconds ?? 0
      const endSec = vid?.endSeconds ?? 0
      const hasSegment = startSec > 0 && endSec > startSec

      if (hasSegment) {
        const segDur = endSec - startSec
        const elapsed = Math.max(0, Math.min(time - startSec, segDur))
        setProgress(elapsed)
        setDuration(segDur)
      } else {
        const dur = player.duration() ?? 0
        if (dur > 0) {
          setProgress(time)
          setDuration(dur)
        }
      }
    }, 250)
  }, [stopVideoPolling])

  // Stop audio playback
  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Stop video playback
  const stopVideo = useCallback(() => {
    stopVideoPolling()
    const vp = videoPlayerRef.current
    if (vp && !vp.isDisposed()) {
      vp.pause()
    }
    setIsVideoVisible(false)
    setIsVideoExpanded(false)
  }, [stopVideoPolling])

  const playAudio = useCallback((sermon: SermonMedia) => {
    const audio = audioRef.current
    if (!audio) return

    // If already playing this sermon as audio, just resume
    if (currentSlugRef.current === sermon.slug && currentMediaTypeRef.current === 'audio') {
      audio.play().catch(() => {})
      return
    }

    // Stop video if active
    stopVideo()
    currentMediaTypeRef.current = 'audio'
    setMediaType('audio')

    // Save progress of current sermon before switching
    saveProgressRef.current?.()

    currentSlugRef.current = sermon.slug
    setCurrentSermon(sermon)
    setIsLoading(true)

    // Resume from saved position if available
    const saved = useListeningStore.getState().history[sermon.slug]
    const resumeTime = saved && !saved.completed && saved.progress > 10 ? saved.progress : 0
    setProgress(resumeTime)

    const filename = sermon.audioUrl.split('/').pop()
    audio.src = filename
      ? `/api/sermon-audio/stream?file=${encodeURIComponent(filename)}`
      : sermon.audioUrl

    audio.playbackRate = useListeningStore.getState().playbackSpeed

    if (resumeTime > 0) {
      const onCanSeek = () => {
        audio.currentTime = resumeTime
        audio.play().catch(() => {})
        audio.removeEventListener('canplay', onCanSeek)
      }
      audio.addEventListener('canplay', onCanSeek)
    } else {
      audio.play().catch(() => {
        const handler = () => {
          audio.play().catch(() => {})
          audio.removeEventListener('canplay', handler)
        }
        audio.addEventListener('canplay', handler)
      })
    }
  }, [stopVideo])

  const playVideo = useCallback((sermon: SermonMedia, video: VideoOption) => {
    // Stop audio if active
    stopAudio()
    saveProgressRef.current?.()

    currentMediaTypeRef.current = 'video'
    setMediaType('video')
    currentSlugRef.current = sermon.slug
    setCurrentSermon(sermon)
    setActiveVideo(video)
    activeVideoRef.current = video
    setIsLoading(true)
    setIsVideoVisible(true)
    setIsVideoExpanded(true) // R6: video starts expanded
    setProgress(0)
    setDuration(0)

    // The VideoContainer component handles player initialization
    // when it sees activeVideo change and isVideoVisible is true.
    // It calls back via registerVideoPlayer when the player is ready.
  }, [stopAudio])

  const play = useCallback((sermon: SermonMedia, type?: 'audio' | 'video', campusSlug?: string) => {
    setIsClosing(false)
    // Resolve media type from preference if not explicitly specified
    let resolvedType = type
    let resolvedCampusSlug = campusSlug

    if (!resolvedType) {
      const pref = useListeningStore.getState().mediaPreference
      if (pref === 'audio') {
        resolvedType = 'audio'
      } else {
        resolvedType = 'video'
        resolvedCampusSlug = resolvedCampusSlug ?? pref.campusSlug
      }
    }

    // If video requested, find the matching video option
    if (resolvedType === 'video' && sermon.videos && sermon.videos.length > 0) {
      let video = resolvedCampusSlug
        ? sermon.videos.find((v) => v.campusSlug === resolvedCampusSlug)
        : sermon.videos[0]

      if (!video) {
        // Silent fallback: preferred campus not available, try first video
        video = sermon.videos[0]
      }

      if (video) {
        playVideo(sermon, video)
        return
      }
    }

    // Fallback to audio (silent, no preference change per R2)
    if (sermon.audioUrl) {
      playAudio(sermon)
    }
  }, [playAudio, playVideo])

  const pause = useCallback(() => {
    if (currentMediaTypeRef.current === 'audio') {
      audioRef.current?.pause()
    } else {
      const vp = videoPlayerRef.current
      if (vp && !vp.isDisposed()) vp.pause()
    }
  }, [])

  const resume = useCallback(() => {
    if (currentMediaTypeRef.current === 'audio') {
      audioRef.current?.play().catch(() => {})
    } else {
      const vp = videoPlayerRef.current
      if (vp && !vp.isDisposed()) vp.play()?.catch(() => {})
    }
  }, [])

  const seek = useCallback((time: number) => {
    if (currentMediaTypeRef.current === 'audio') {
      if (audioRef.current) audioRef.current.currentTime = time
    } else {
      const vp = videoPlayerRef.current
      if (vp && !vp.isDisposed()) {
        // time is segment-relative; offset by startSeconds for the actual YouTube position
        const startSec = activeVideoRef.current?.startSeconds ?? 0
        const endSec = activeVideoRef.current?.endSeconds ?? 0
        const hasSegment = startSec > 0 && endSec > startSec
        vp.currentTime(hasSegment ? startSec + time : time)
      }
    }
  }, [])

  const setSpeed = useCallback((speed: number) => {
    if (audioRef.current) audioRef.current.playbackRate = speed
    const vp = videoPlayerRef.current
    if (vp && !vp.isDisposed()) vp.playbackRate(speed)
    setPlaybackSpeed(speed)
  }, [setPlaybackSpeed])

  const skipForward = useCallback(() => {
    if (currentMediaTypeRef.current === 'audio' && audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration || 0,
        audioRef.current.currentTime + SKIP_SECONDS,
      )
    } else {
      const vp = videoPlayerRef.current
      if (vp && !vp.isDisposed()) {
        const endSec = activeVideoRef.current?.endSeconds ?? 0
        const maxTime = endSec > 0 ? endSec : (vp.duration() ?? 0)
        vp.currentTime(Math.min(maxTime, (vp.currentTime() ?? 0) + SKIP_SECONDS))
      }
    }
  }, [])

  const skipBack = useCallback(() => {
    if (currentMediaTypeRef.current === 'audio' && audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        audioRef.current.currentTime - SKIP_SECONDS,
      )
    } else {
      const vp = videoPlayerRef.current
      if (vp && !vp.isDisposed()) {
        const startSec = activeVideoRef.current?.startSeconds ?? 0
        vp.currentTime(Math.max(startSec, (vp.currentTime() ?? 0) - SKIP_SECONDS))
      }
    }
  }, [])

  const close = useCallback(() => {
    saveProgressRef.current?.()
    stopAudio()
    stopVideo()
    stopVideoPolling()
    currentSlugRef.current = null
    currentMediaTypeRef.current = 'audio'
    setCurrentSermon(null)
    setActiveVideo(null)
    activeVideoRef.current = null
    setMediaType('audio')
    setIsPlaying(false)
    setProgress(0)
    setDuration(0)
  }, [stopAudio, stopVideo, stopVideoPolling])

  closeRef.current = close

  const expandVideo = useCallback(() => {
    if (currentMediaTypeRef.current === 'video') {
      setIsVideoExpanded(true)
    }
  }, [])

  const minimizeVideo = useCallback(() => {
    setIsVideoExpanded(false)
  }, [])

  const registerVideoPlayer = useCallback((player: Player) => {
    videoPlayerRef.current = player

    player.on('playing', () => {
      if (currentMediaTypeRef.current !== 'video') return
      setIsPlaying(true)
      setIsLoading(false)
      startVideoPolling()
    })

    player.on('pause', () => {
      if (currentMediaTypeRef.current !== 'video') return
      setIsPlaying(false)
      stopVideoPolling()
    })

    player.on('ended', () => {
      if (currentMediaTypeRef.current !== 'video') return
      // Use animated close (bar slide-down) when available
      if (onEndedRef.current) onEndedRef.current()
      else closeRef.current?.()
    })
  }, [startVideoPolling, stopVideoPolling])

  return (
    <MediaPlayerContext.Provider
      value={{
        currentSermon,
        mediaType,
        activeVideo,
        isPlaying,
        isLoading,
        progress,
        duration,
        playbackSpeed,
        isVideoExpanded,
        isVideoVisible,
        isClosing,
        setIsClosing,
        play,
        pause,
        resume,
        seek,
        setSpeed,
        skipForward,
        skipBack,
        close,
        expandVideo,
        minimizeVideo,
        registerVideoPlayer,
        videoContainerRef,
        videoThumbnailRef,
        onEndedRef,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  )
}
