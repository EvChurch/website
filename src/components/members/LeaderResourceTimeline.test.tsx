import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { MemberLeaderResource } from '@/lib/members/data'

vi.mock('./LeaderResourceVideoButton', () => ({
  LeaderResourceVideoButton: ({ media }: { media: { id: string } }) => (
    <button type="button">Play video: {media.id}</button>
  ),
}))

import { formatResourceDates } from './LeaderResourceCard'
import {
  groupResourcesByBibleBook,
  LeaderResourceThisWeek,
  LeaderResourceTimeline,
} from './LeaderResourceTimeline'

function resource(
  overrides: Partial<MemberLeaderResource> = {},
): MemberLeaderResource {
  return {
    rockId: 245,
    title: 'Hebrews Study 4',
    startDateTime: '2026-08-09T00:00:00.000Z',
    expireDateTime: '2026-08-15T00:00:00.000Z',
    description: 'Everything needed to prepare and lead this week.',
    youtubeUrl: null,
    promotionalImageUrl: '/protected-image',
    hosts: [{ name: 'Ryan Green', avatarUrl: null }],
    bibleReference: 'Hebrews 4:14-5:10',
    hasLeaderNotes: true,
    hasMemberStudy: true,
    campusNames: [],
    priority: 0,
    sourceOrder: 0,
    ...overrides,
  }
}

describe('LeaderResourceTimeline', () => {
  it('groups only consecutive runs of the same Bible book', () => {
    const groups = groupResourcesByBibleBook([
      resource({ rockId: 5, title: 'Hebrews Study 2' }),
      resource({
        rockId: 4,
        title: 'Hebrews CG Leaders Launch',
        bibleReference: null,
      }),
      resource({
        rockId: 3,
        title: 'Numbers Study 1',
        bibleReference: 'Number 21',
      }),
      resource({
        rockId: 2,
        title: 'Numbers CG Leaders Launch',
        bibleReference: null,
      }),
      resource({ rockId: 1, title: 'Older Hebrews Study' }),
    ])

    expect(groups.map((group) => ({
      book: group.book,
      rockIds: group.resources.map((item) => item.rockId),
    }))).toEqual([
      { book: 'Hebrews', rockIds: [5, 4] },
      { book: 'Numbers', rockIds: [3, 2] },
      { book: 'Hebrews', rockIds: [1] },
    ])
  })

  it('distinguishes compact numbered book references', () => {
    const groups = groupResourcesByBibleBook([
      resource({ rockId: 2, bibleReference: '1John 2:1' }),
      resource({ rockId: 1, bibleReference: 'John 3:16' }),
    ])

    expect(groups.map((group) => group.book)).toEqual(['1 John', 'John'])
  })

  it('shows a start-only date without a prefix', () => {
    expect(formatResourceDates(resource({ expireDateTime: null }))).toBe('9 Aug')
  })

  it('features the weekly study and separates a current leaders launch', () => {
    const markup = renderToStaticMarkup(
      <LeaderResourceTimeline
        current={[
          resource({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
          resource({
            rockId: 240,
            title: 'Hebrews 2026 CG Leaders Launch',
            startDateTime: '2026-07-06T00:00:00.000Z',
            expireDateTime: null,
            hasMemberStudy: false,
          }),
        ]}
        upcoming={[]}
        history={[
          resource({ rockId: 244, title: 'Hebrews Study 3' }),
          resource({
            rockId: 237,
            title: 'Numbers Study 11',
            bibleReference: 'Numbers 33-36',
            promotionalImageUrl: '/numbers-image',
          }),
          resource({
            rockId: 120,
            title: 'Earlier Hebrews Study',
            promotionalImageUrl: '/older-hebrews-image',
          }),
        ]}
      />,
    )

    expect(markup).toContain('This week')
    expect(markup).toContain('9 Aug - 15 Aug')
    expect(markup.indexOf('Hebrews Study 4')).toBeLessThan(
      markup.indexOf('Hebrews 2026 CG Leaders Launch'),
    )
    expect(markup).not.toContain('Notes and Study')
    expect(markup).toContain('/245/files/leader-notes')
    expect(markup).toContain('/245/files/member-study')
    expect(markup).toContain('> Notes</a>')
    expect(markup).toContain('> Study</a>')
    expect(markup).toContain('mt-3 flex gap-4 text-sm font-bold text-rich-red')
    expect(markup).toContain('Play video: connect-group-resource-245')
    expect(markup).toContain('h-2.5 w-2.5')
    expect(markup).toContain('href="/members/connect-group-leader-resources/245"')
    expect(markup.match(/<img[^>]+src="\/_next\/image\?url=%2Fprotected-image/gu)).toHaveLength(2)
    expect(markup.match(/<img[^>]+src="\/_next\/image\?url=%2Fnumbers-image/gu)).toHaveLength(1)
    expect(markup.match(/<img[^>]+src="\/_next\/image\?url=%2Folder-hebrews-image/gu)).toHaveLength(1)
    expect(markup).not.toContain('class="aspect-video w-full overflow-hidden')
    expect(markup).not.toContain('id="history-heading"')
    expect(markup).not.toContain('Earlier studies')
    expect(markup).not.toContain('<h4')
  })

  it('shows members only the study action and public weekly content', () => {
    const markup = renderToStaticMarkup(
      <LeaderResourceThisWeek
        current={[
          resource({
            youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            hosts: [{ name: 'Ryan Green', avatarUrl: null }],
          }),
          resource({
            rockId: 240,
            title: 'Hebrews 2026 CG Leaders Launch',
            hasMemberStudy: false,
          }),
        ]}
        audience="member"
      />,
    )

    expect(markup).toContain('This week')
    expect(markup).toContain('Hebrews Study 4')
    expect(markup).toContain('Hebrews 4:14-5:10')
    expect(markup).toContain('/245/files/member-study')
    expect(markup).toContain('> Study</a>')
    expect(markup).not.toContain('Play video:')
    expect(markup).not.toContain('Ryan Green')
    expect(markup).not.toContain('Hebrews 2026 CG Leaders Launch')
    expect(markup).not.toContain('/245/files/leader-notes')
    expect(markup).not.toContain('href="/members/connect-group-leader-resources/245"')
  })

  it('keeps leader-only actions out of the member archive and upcoming studies', () => {
    const markup = renderToStaticMarkup(
      <LeaderResourceTimeline
        current={[]}
        upcoming={[resource({ rockId: 246, title: 'Upcoming Study', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })]}
        history={[resource({ rockId: 244, title: 'Earlier Study', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })]}
        audience="member"
      />,
    )

    expect(markup).toContain('/246/files/member-study')
    expect(markup).toContain('/244/files/member-study')
    expect(markup).not.toContain('/files/leader-notes')
    expect(markup).not.toContain('Play video:')
    expect(markup).not.toContain('Share')
    expect(markup).toContain('mx-auto mt-1 block h-2.5 w-2.5')
    expect(markup).toContain('mt-3 flex w-fit text-sm font-bold text-rich-red')
    expect(markup).toContain('Coming up')
    expect(markup).toContain('Earlier studies')
  })
})
