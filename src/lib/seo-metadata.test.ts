import { describe, expect, it } from 'vitest'

import { DEFAULT_OPEN_GRAPH_IMAGES, truncateMetaDescription } from './seo-metadata'

describe('SEO metadata', () => {
  it('provides a shareable default Open Graph image', () => {
    expect(DEFAULT_OPEN_GRAPH_IMAGES).toEqual([
      {
        url: '/og-image',
        width: 1200,
        height: 630,
        alt: 'Ev Church — a community of Christ-followers across Auckland',
      },
    ])
  })

  it('shortens descriptions at a word boundary', () => {
    const description = 'A detailed description '.repeat(12).trim()
    const result = truncateMetaDescription(description)

    expect(result.length).toBeLessThanOrEqual(160)
    expect(result).toMatch(/…$/u)
  })

  it('preserves descriptions within the limit', () => {
    expect(truncateMetaDescription('A concise description.')).toBe('A concise description.')
  })
})
