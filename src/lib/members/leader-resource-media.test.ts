import { describe, expect, it } from 'vitest'

import type { MemberLeaderResource } from './data'
import { leaderResourceMedia } from './leader-resource-media'

const resource: MemberLeaderResource = {
  rockId: 245,
  title: 'Hebrews Study 4',
  startDateTime: '2026-08-09T00:00:00.000Z',
  expireDateTime: '2026-08-15T00:00:00.000Z',
  description: null,
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  promotionalImageUrl: '/protected-image',
  hosts: [{ name: 'Ryan Green', avatarUrl: null }],
  bibleReference: 'Hebrews 4:14-5:10',
  hasLeaderNotes: true,
  hasMemberStudy: true,
  campusNames: [],
  priority: 0,
  sourceOrder: 0,
}

describe('leaderResourceMedia', () => {
  it('gives every resource a distinct resumable player identity and return link', () => {
    expect(leaderResourceMedia(resource)).toEqual({
      id: 'connect-group-resource-245',
      slug: 'connect-group-resource-245',
      title: 'Hebrews Study 4',
      href: '/members/connect-group-leader-resources/245',
      access: 'members',
      audioUrl: '',
      speaker: 'Ryan Green',
      series: 'Connect Group Leader Resources',
      artworkUrl: '/protected-image',
      passageReference: 'Hebrews 4:14-5:10',
      videos: [{
        campusName: 'Video',
        campusSlug: 'resource-video',
        youtubeVideoId: 'dQw4w9WgXcQ',
      }],
    })
  })

  it('does not create playable media for an invalid URL', () => {
    expect(leaderResourceMedia({ ...resource, youtubeUrl: 'https://example.com/video' })).toBeNull()
    expect(leaderResourceMedia({ ...resource, youtubeUrl: 'not a URL' })).toBeNull()
  })
})
