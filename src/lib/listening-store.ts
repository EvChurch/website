import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ListeningVideoOption {
  campusName: string
  campusSlug: string
  youtubeVideoId: string
  startSeconds?: number
  endSeconds?: number
  speakerName?: string
  speakerSlug?: string
}

export interface ListeningRecord {
  slug: string
  title: string
  /** Canonical page for this media item. Defaults to its sermon page. */
  href?: string
  access?: 'public' | 'members'
  speaker?: string
  series?: string
  artworkUrl?: string
  artworkBlurDataURL?: string
  audioUrl: string
  videos?: ListeningVideoOption[]
  passageReference?: string
  /** Which media type was active when progress was saved */
  playedAs?: 'audio' | { type: 'video'; campusSlug: string }
  progress: number
  duration: number
  completed: boolean
  lastPlayedAt: number
}

const COMPLETED_THRESHOLD = 0.95
const COMPLETED_REMAINING_SECS = 300 // 5 minutes

export function isPublicListeningRecord(record: ListeningRecord): boolean {
  return record.access !== 'members'
}

export function matchesSavedVideoProgress(
  record: ListeningRecord | undefined,
  campusSlug: string,
  allowLegacyMemberVideo = false,
): boolean {
  if (!record) return false
  if (record.playedAs === undefined) {
    return allowLegacyMemberVideo && record.access === 'members'
  }
  return record.playedAs !== 'audio' && record.playedAs.campusSlug === campusSlug
}

export function listeningHistoryForPersistence(
  history: Record<string, ListeningRecord>,
): Record<string, ListeningRecord> {
  return Object.fromEntries(
    Object.entries(history).map(([slug, record]) => (
      record.access === 'members'
        ? [slug, {
            slug: record.slug,
            title: '',
            audioUrl: '',
            access: 'members' as const,
            playedAs: record.playedAs,
            progress: record.progress,
            duration: record.duration,
            completed: record.completed,
            lastPlayedAt: record.lastPlayedAt,
          }]
        : [slug, record]
    )),
  )
}

export type MediaPreference = 'audio' | { type: 'video'; campusSlug: string }

interface ListeningState {
  history: Record<string, ListeningRecord>
  playbackSpeed: number
  mediaPreference: MediaPreference

  getProgress: (slug: string) => ListeningRecord | null
  getListeningHistory: () => ListeningRecord[]
  saveProgress: (sermon: {
    slug: string
    title: string
    href?: string
    access?: 'public' | 'members'
    speaker?: string
    series?: string
    artworkUrl?: string
    artworkBlurDataURL?: string
    audioUrl: string
    videos?: ListeningVideoOption[]
    passageReference?: string
    playedAs?: 'audio' | { type: 'video'; campusSlug: string }
  }, currentTime: number, audioDuration: number, fallbackDuration?: number) => void
  markCompleted: (slug: string) => void
  markAsListened: (slug: string) => void
  setPlaybackSpeed: (speed: number) => void
  setMediaPreference: (pref: MediaPreference) => void
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set, get) => ({
      history: {},
      playbackSpeed: 1,
      mediaPreference: 'audio' as MediaPreference,

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
              href: sermon.href ?? state.history[sermon.slug]?.href,
              access: sermon.access ?? state.history[sermon.slug]?.access,
              speaker: sermon.speaker,
              series: sermon.series,
              artworkUrl: sermon.artworkUrl,
              artworkBlurDataURL: sermon.artworkBlurDataURL,
              audioUrl: sermon.audioUrl,
              videos: sermon.videos ?? state.history[sermon.slug]?.videos,
              passageReference: sermon.passageReference ?? state.history[sermon.slug]?.passageReference,
              playedAs: sermon.playedAs ?? state.history[sermon.slug]?.playedAs,
              progress: currentTime,
              duration: dur,
              completed: state.history[sermon.slug]?.completed || (dur > 0 && (
                currentTime / dur >= COMPLETED_THRESHOLD ||
                (sermon.access !== 'members' && dur - currentTime <= COMPLETED_REMAINING_SECS)
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
      setMediaPreference: (pref) => set({ mediaPreference: pref }),
    }),
    {
      name: 'ev-sermon-history',
      partialize: (state) => ({
        history: listeningHistoryForPersistence(state.history),
        playbackSpeed: state.playbackSpeed,
        mediaPreference: state.mediaPreference,
      }),
    },
  ),
)
