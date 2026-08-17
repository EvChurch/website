import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn() }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import { GET } from './route'

describe('sermon RSS feed', () => {
  beforeEach(() => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          title: 'A sermon',
          slug: 'a-sermon',
          publishedAt: '2026-08-16T09:35:00.000Z',
          duration: 1840,
          audio: { url: '/api/sermon-audio/file/a-sermon.m4a' },
          audioSpeaker: { name: 'A Speaker' },
          scriptures: [{ name: 'John 1:1-5' }],
          series: [
            {
              bannerImage: {
                sizes: {
                  medium: { url: '/api/media/file/a-series-900x506.png' },
                  mediumWebp: { url: '/api/media/file/a-series-900x506.webp' },
                },
              },
            },
          ],
        },
      ],
    })
  })

  it('emits absolute, working media locations', async () => {
    const response = await GET()
    const body = await response.text()

    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ depth: 2 }))
    expect(body).toContain(
      '<enclosure url="https://www.ev.church/api/sermon-audio/file/a-sermon.m4a" type="audio/x-m4a"/>',
    )
    expect(body).toContain(
      '<itunes:image href="https://www.ev.church/api/media/file/a-series-900x506.png"/>',
    )
    expect(body).not.toContain('a-series-900x506.webp')
    expect(body).toContain(
      '<itunes:image href="https://www.ev.church/images/ev_church_podcast-09e38534.jpg"/>',
    )
    expect(body).not.toContain('resources.ev.church')

    const mediaLocations = [...body.matchAll(/(?:href|url)="([^"]+)"/g)].map((match) => match[1])
    expect(mediaLocations.every((url) => url.startsWith('https://'))).toBe(true)
  })
})
