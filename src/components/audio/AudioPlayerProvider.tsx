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
import { useListeningStore } from '@/lib/listening-store'

export interface SermonAudio {
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
}

// Re-export for consumers that still import from here
export type { ListeningRecord } from '@/lib/listening-store'

interface AudioPlayerState {
  currentSermon: SermonAudio | null
  isPlaying: boolean
  isLoading: boolean
  progress: number
  duration: number
  playbackSpeed: number
  play: (sermon: SermonAudio) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  skipForward: () => void
  skipBack: () => void
  close: () => void
  onEndedRef: React.MutableRefObject<(() => void) | null>
}

const AudioPlayerContext = createContext<AudioPlayerState | null>(null)

export function useAudioPlayer(): AudioPlayerState {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
  }
  return context
}

const SKIP_SECONDS = 15

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentSermon, setCurrentSermon] = useState<SermonAudio | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const { playbackSpeed, setPlaybackSpeed, saveProgress, markCompleted } =
    useListeningStore()

  const currentSlugRef = useRef<string | null>(null)
  const saveProgressRef = useRef<(() => void) | null>(null)
  const markCompletedRef = useRef<(() => void) | null>(null)
  const closeRef = useRef<(() => void) | null>(null)
  const onEndedRef = useRef<(() => void) | null>(null)

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    // Restore playback speed
    const speed = useListeningStore.getState().playbackSpeed
    audio.playbackRate = speed

    const onTimeUpdate = () => {
      setProgress(audio.currentTime)
      if (Math.floor(audio.currentTime) % 5 === 0 && audio.currentTime > 0) {
        saveProgressRef.current?.()
      }
    }
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onPlay = () => {
      setIsPlaying(true)
      setIsLoading(false)
    }
    const onPause = () => {
      setIsPlaying(false)
      saveProgressRef.current?.()
    }
    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onError = () => setIsLoading(false)
    const onEnded = () => {
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

  // Media Session API for lock screen controls
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
      audioRef.current?.play()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause()
    })
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(
          0,
          audioRef.current.currentTime - SKIP_SECONDS,
        )
      }
    })
    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration || 0,
          audioRef.current.currentTime + SKIP_SECONDS,
        )
      }
    })
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (audioRef.current && details.seekTime != null) {
        audioRef.current.currentTime = details.seekTime
      }
    })
  }, [currentSermon])

  // Update Media Session position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: playbackSpeed,
      position: Math.min(progress, duration),
    })
  }, [progress, duration, playbackSpeed])

  // Keep refs up to date for use in audio event handlers
  saveProgressRef.current = () => {
    if (!currentSermon || !audioRef.current) return
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

  const play = useCallback((sermon: SermonAudio) => {
    const audio = audioRef.current
    if (!audio) return

    if (currentSlugRef.current === sermon.slug) {
      audio.play().catch(() => {})
      return
    }

    // Save progress of current sermon before switching
    saveProgressRef.current?.()

    // New sermon
    currentSlugRef.current = sermon.slug
    setCurrentSermon(sermon)
    setIsLoading(true)

    // Resume from saved position if available
    const saved = useListeningStore.getState().history[sermon.slug]
    const resumeTime = saved && !saved.completed && saved.progress > 10 ? saved.progress : 0
    setProgress(resumeTime)

    // Use streaming endpoint for direct S3 signed URL (supports range requests)
    const filename = sermon.audioUrl.split('/').pop()
    audio.src = filename
      ? `/api/sermon-audio/stream?file=${encodeURIComponent(filename)}`
      : sermon.audioUrl
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
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {})
  }, [])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  const setSpeed = useCallback((speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
    setPlaybackSpeed(speed)
  }, [setPlaybackSpeed])

  const skipForward = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration || 0,
        audioRef.current.currentTime + SKIP_SECONDS,
      )
    }
  }, [])

  const skipBack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        audioRef.current.currentTime - SKIP_SECONDS,
      )
    }
  }, [])

  const close = useCallback(() => {
    saveProgressRef.current?.()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    currentSlugRef.current = null
    setCurrentSermon(null)
    setIsPlaying(false)
    setProgress(0)
    setDuration(0)
  }, [])

  closeRef.current = close

  return (
    <AudioPlayerContext.Provider
      value={{
        currentSermon,
        isPlaying,
        isLoading,
        progress,
        duration,
        playbackSpeed,
        play,
        pause,
        resume,
        seek,
        setSpeed,
        skipForward,
        skipBack,
        close,
        onEndedRef,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  )
}
