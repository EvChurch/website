import { describe, expect, it } from 'vitest'

import { DEFAULT_OPEN_GRAPH_IMAGES, buildSermonMetaTitle, truncateMetaDescription } from './seo-metadata'

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

describe('sermon titles', () => {
  it('preserves the section suffix for short subjects', () => {
    expect(buildSermonMetaTitle('Psalm 27', 'Sermons')).toBe('Psalm 27 | Sermons | Ev Church')
    expect(buildSermonMetaTitle('Living Hope', 'Sermon Series')).toBe('Living Hope | Sermon Series | Ev Church')
  })

  it('drops the generic suffix before shortening the subject', () => {
    const title = 'Habakkuk: Generosity and Joy Through Hardship'
    expect(buildSermonMetaTitle(title, 'Sermon Series')).toBe(`${title} | Ev Church`)
  })

  it('shortens unusually long subjects at a word boundary', () => {
    expect(buildSermonMetaTitle('The Good Shepherd Lays Down His Life for the Sheep (Good Friday Service)', 'Sermons'))
      .toBe('The Good Shepherd Lays Down His Life for the Sheep (Good… | Ev Church')
  })
})
