import { describe, expect, it } from 'vitest'

import {
  isPublicListeningRecord,
  matchesSavedVideoProgress,
  listeningHistoryForPersistence,
  type ListeningRecord,
  useListeningStore,
} from './listening-store'

function record(overrides: Partial<ListeningRecord> = {}): ListeningRecord {
  return {
    slug: 'sermon-one',
    title: 'A sermon',
    audioUrl: '/sermon.mp3',
    progress: 120,
    duration: 1200,
    completed: false,
    lastPlayedAt: 1,
    ...overrides,
  }
}

describe('listening history access boundaries', () => {
  it('persists member progress without protected metadata', () => {
    const persisted = listeningHistoryForPersistence({
      'connect-group-resource-245': record({
        slug: 'connect-group-resource-245',
        title: 'Hebrews Study 4',
        href: '/members/connect-group-leader-resources/245',
        access: 'members',
        artworkUrl: '/members/connect-group-leader-resources/245/image',
        playedAs: { type: 'video', campusSlug: 'resource-video' },
        videos: [{
          campusName: 'Video',
          campusSlug: 'resource-video',
          youtubeVideoId: 'dQw4w9WgXcQ',
        }],
      }),
    })

    expect(persisted['connect-group-resource-245']).toEqual({
      slug: 'connect-group-resource-245',
      title: '',
      audioUrl: '',
      access: 'members',
      playedAs: { type: 'video', campusSlug: 'resource-video' },
      progress: 120,
      duration: 1200,
      completed: false,
      lastPlayedAt: 1,
    })
    expect(isPublicListeningRecord(persisted['connect-group-resource-245'])).toBe(false)
  })

  it('keeps public sermon records intact', () => {
    const sermon = record()
    expect(listeningHistoryForPersistence({ 'sermon-one': sermon })).toEqual({
      'sermon-one': sermon,
    })
    expect(isPublicListeningRecord(sermon)).toBe(true)
  })

  it('recognizes legacy progress for video-only member media', () => {
    const legacy = record({
      access: 'members',
      playedAs: undefined,
      slug: 'connect-group-resource-245',
    })

    expect(matchesSavedVideoProgress(legacy, 'resource-video', true)).toBe(true)
    expect(matchesSavedVideoProgress(legacy, 'resource-video', false)).toBe(false)
  })

  it('does not complete a short member video until it reaches 95 percent', () => {
    useListeningStore.setState({ history: {} })
    const saveProgress = useListeningStore.getState().saveProgress
    const memberVideo = {
      slug: 'connect-group-resource-245',
      title: 'Hebrews Study 4',
      access: 'members' as const,
      audioUrl: '',
      playedAs: { type: 'video' as const, campusSlug: 'resource-video' },
    }

    saveProgress(memberVideo, 30, 240)
    expect(useListeningStore.getState().history[memberVideo.slug]?.completed).toBe(false)

    saveProgress(memberVideo, 228, 240)
    expect(useListeningStore.getState().history[memberVideo.slug]?.completed).toBe(true)
  })

  it('retains the five-minute completion allowance for public sermons', () => {
    useListeningStore.setState({ history: {} })
    useListeningStore.getState().saveProgress({
      slug: 'sermon-one',
      title: 'A sermon',
      access: 'public',
      audioUrl: '/sermon.mp3',
    }, 901, 1200)

    expect(useListeningStore.getState().history['sermon-one']?.completed).toBe(true)
  })
})
