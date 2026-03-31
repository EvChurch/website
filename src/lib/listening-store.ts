import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ListeningRecord {
  slug: string
  title: string
  speaker?: string
  series?: string
  artworkUrl?: string
  artworkBlurDataURL?: string
  audioUrl: string
  progress: number
  duration: number
  completed: boolean
  lastPlayedAt: number
}

const COMPLETED_THRESHOLD = 0.95
const COMPLETED_REMAINING_SECS = 300 // 5 minutes

interface ListeningState {
  history: Record<string, ListeningRecord>
  playbackSpeed: number

  getProgress: (slug: string) => ListeningRecord | null
  getListeningHistory: () => ListeningRecord[]
  saveProgress: (sermon: {
    slug: string
    title: string
    speaker?: string
    series?: string
    artworkUrl?: string
    artworkBlurDataURL?: string
    audioUrl: string
  }, currentTime: number, audioDuration: number, fallbackDuration?: number) => void
  markCompleted: (slug: string) => void
  markAsListened: (slug: string) => void
  setPlaybackSpeed: (speed: number) => void
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set, get) => ({
      history: {},
      playbackSpeed: 1,

      getProgress: (slug) => get().history[slug] ?? null,

      getListeningHistory: () =>
        Object.values(get().history).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),

      saveProgress: (sermon, currentTime, audioDuration, fallbackDuration) => {
        const dur = audioDuration || fallbackDuration || 0
        set((state) => ({
          history: {
            ...state.history,
            [sermon.slug]: {
              slug: sermon.slug,
              title: sermon.title,
              speaker: sermon.speaker,
              series: sermon.series,
              artworkUrl: sermon.artworkUrl,
              artworkBlurDataURL: sermon.artworkBlurDataURL,
              audioUrl: sermon.audioUrl,
              progress: currentTime,
              duration: dur,
              completed: state.history[sermon.slug]?.completed || (dur > 0 && (
                currentTime / dur >= COMPLETED_THRESHOLD ||
                dur - currentTime <= COMPLETED_REMAINING_SECS
              )),
              lastPlayedAt: Date.now(),
            },
          },
        }))
      },

      markCompleted: (slug) => {
        set((state) => {
          const existing = state.history[slug]
          if (!existing) return state
          return {
            history: {
              ...state.history,
              [slug]: { ...existing, completed: true, lastPlayedAt: Date.now() },
            },
          }
        })
      },

      markAsListened: (slug) => {
        set((state) => {
          const existing = state.history[slug]
          return {
            history: {
              ...state.history,
              [slug]: existing
                ? { ...existing, completed: true, lastPlayedAt: Date.now() }
                : {
                    slug,
                    title: '',
                    audioUrl: '',
                    progress: 0,
                    duration: 0,
                    completed: true,
                    lastPlayedAt: Date.now(),
                  },
            },
          }
        })
      },

      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    }),
    {
      name: 'ev-sermon-history',
      partialize: (state) => ({
        history: state.history,
        playbackSpeed: state.playbackSpeed,
      }),
    },
  ),
)
