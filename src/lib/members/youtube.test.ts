import { describe, expect, it } from 'vitest'

import { youtubeVideoId } from './youtube'

describe('youtubeVideoId', () => {
  it('returns the video identity used by the shared media player', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    )
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeVideoId('javascript:alert(1)')).toBeNull()
    expect(youtubeVideoId('not a URL')).toBeNull()
    expect(youtubeVideoId('https://youtube.com/watch?v=not valid')).toBeNull()
  })
})
