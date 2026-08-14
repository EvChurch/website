import { describe, expect, it } from 'vitest'

import { openGraphImageContentType, openGraphImageSize } from '@/components/seo/OpenGraphImage'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'
import { GET } from './route'

describe('GET /og-image', () => {
  it('returns the image promised by the fallback metadata', async () => {
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(openGraphImageContentType)
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
    expect(DEFAULT_OPEN_GRAPH_IMAGES[0]).toMatchObject(openGraphImageSize)
  })
})
