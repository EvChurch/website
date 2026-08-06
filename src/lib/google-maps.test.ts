import { describe, expect, it } from 'vitest'

import { getGoogleMapsEmbedUrl, isGoogleMapsUrl } from './google-maps'

describe('Google Maps URLs', () => {
  it.each([
    'https://google.com/maps?q=North',
    'https://www.google.com/maps/place/?q=place_id%3ANorth',
    'https://maps.google.com/maps?q=North',
  ])('recognizes supported map URLs: %s', (url) => {
    expect(isGoogleMapsUrl(url)).toBe(true)
  })

  it.each([
    'http://www.google.com/maps?q=North',
    'https://www.google.com/search?q=North',
    'https://www.google.com/maps.evil.example/maps?q=North',
    'https://www.google.com.evil.example/maps?q=North',
  ])('rejects unsupported map URLs: %s', (url) => {
    expect(isGoogleMapsUrl(url)).toBe(false)
  })

  it('falls back to an address when the managed URL cannot be embedded', () => {
    expect(getGoogleMapsEmbedUrl('not a URL', '9 Rothwell Avenue')).toBe(
      'https://www.google.com/maps?q=9+Rothwell+Avenue&output=embed',
    )
  })
})
