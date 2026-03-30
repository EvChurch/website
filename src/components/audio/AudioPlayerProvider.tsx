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
  duration?: number
}

export interface ListeningRecord {
  slug: string
  title: string
  speaker?: string
  series?: string
  artworkUrl?: string
  audioUrl: string
  progress: number
  duration: number
  completed: boolean
  lastPlayedAt: number
}

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
  getListeningHistory: () => ListeningRecord[]
  getProgress: (slug: string) => ListeningRecord | null
  markAsListened: (slug: string) => void
}

const AudioPlayerContext = createContext<AudioPlayerState | null>(null)

export function useAudioPlayer(): AudioPlayerState {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
  }
  return context
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const
const SKIP_SECONDS = 15
const STORAGE_KEY = 'ev-sermon-playback-speed'
const HISTORY_KEY = 'ev-sermon-history'
const COMPLETED_THRESHOLD = 0.95
const COMPLETED_REMAINING_SECS = 300 // 5 minutes

function getStoredHistory(): Record<string, ListeningRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(HISTORY_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveHistory(history: Record<string, ListeningRecord>) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // localStorage full or unavailable
  }
}

function getStoredSpeed(): number {
  if (typeof window === 'undefined') return 1
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = parseFloat(stored)
    if (SPEED_OPTIONS.includes(parsed as (typeof SPEED_OPTIONS)[number])) {
      return parsed
    }
  }
  return 1
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentSermon, setCurrentSermon] = useState<SermonAudio | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    // Restore playback speed
    const storedSpeed = getStoredSpeed()
    audio.playbackRate = storedSpeed
    setPlaybackSpeed(storedSpeed)

    const onTimeUpdate = () => {
      setProgress(audio.currentTime)
      // Save progress every 5 seconds
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
      setIsPlaying(false)
      setProgress(0)
      markCompletedRef.current?.()
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

  const currentSlugRef = useRef<string | null>(null)
  const historyRef = useRef<Record<string, ListeningRecord>>(getStoredHistory())
  const saveProgressRef = useRef<(() => void) | null>(null)
  const markCompletedRef = useRef<(() => void) | null>(null)

  // Keep refs up to date for use in audio event handlers
  saveProgressRef.current = () => {
    if (!currentSermon || !audioRef.current) return
    const audio = audioRef.current
    const record: ListeningRecord = {
      slug: currentSermon.slug,
      title: currentSermon.title,
      speaker: currentSermon.speaker,
      series: currentSermon.series,
      artworkUrl: currentSermon.artworkUrl,
      audioUrl: currentSermon.audioUrl,
      progress: audio.currentTime,
      duration: audio.duration || currentSermon.duration || 0,
      completed: audio.duration > 0 && (
        audio.currentTime / audio.duration >= COMPLETED_THRESHOLD ||
        audio.duration - audio.currentTime <= COMPLETED_REMAINING_SECS
      ),
      lastPlayedAt: Date.now(),
    }
    historyRef.current[currentSermon.slug] = record
    saveHistory(historyRef.current)
  }

  markCompletedRef.current = () => {
    if (!currentSermon) return
    const existing = historyRef.current[currentSermon.slug]
    if (existing) {
      existing.completed = true
      existing.lastPlayedAt = Date.now()
      saveHistory(historyRef.current)
    }
  }

  const getListeningHistory = useCallback((): ListeningRecord[] => {
    return Object.values(historyRef.current).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
  }, [])

  const getProgress = useCallback((slug: string): ListeningRecord | null => {
    return historyRef.current[slug] ?? null
  }, [])

  const markAsListened = useCallback((slug: string) => {
    const record = historyRef.current[slug]
    if (record) {
      record.completed = true
      record.lastPlayedAt = Date.now()
    } else {
      historyRef.current[slug] = {
        slug,
        title: '',
        audioUrl: '',
        progress: 0,
        duration: 0,
        completed: true,
        lastPlayedAt: Date.now(),
      }
    }
    saveHistory(historyRef.current)
  }, [])

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
    const saved = historyRef.current[sermon.slug]
    const resumeTime = saved && !saved.completed && saved.progress > 10 ? saved.progress : 0
    setProgress(resumeTime)

    audio.src = sermon.audioUrl
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
    localStorage.setItem(STORAGE_KEY, String(speed))
  }, [])

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
        getListeningHistory,
        getProgress,
        markAsListened,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  )
}
