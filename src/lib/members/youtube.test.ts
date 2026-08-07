import { describe, expect, it } from 'vitest'

import { youtubeEmbedUrl } from './youtube'

describe('youtubeEmbedUrl', () => {
  it('accepts standard, short, and embed YouTube URLs', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(youtubeEmbedUrl('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
  })

  it('rejects unrelated hosts and malformed video IDs', () => {
    expect(youtubeEmbedUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeEmbedUrl('javascript:alert(1)')).toBeNull()
    expect(youtubeEmbedUrl('https://youtube.com/watch?v=not valid')).toBeNull()
  })
})
