import { describe, expect, it } from 'vitest'

import {
  isPublicListeningRecord,
  matchesSavedVideoProgress,
  listeningHistoryForPersistence,
  type ListeningRecord,
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
})
