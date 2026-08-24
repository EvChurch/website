import { describe, expect, it } from 'vitest'

import nextConfig from '../next.config'

describe('canonical host redirects', () => {
  it('permanently redirects every new.ev.church path to the www canonical host', async () => {
    const redirects = await nextConfig.redirects?.()

    expect(redirects).toContainEqual({
      source: '/:path*',
      has: [{ type: 'host', value: 'new.ev.church' }],
      destination: 'https://www.ev.church/:path*',
      permanent: true,
    })
  })

  it('keeps the local /give page and its child routes out of redirect handling', async () => {
    const redirects = await nextConfig.redirects?.()
    expect(redirects).not.toContainEqual(expect.objectContaining({ source: '/give' }))
    expect(redirects).not.toContainEqual(expect.objectContaining({ source: '/give/:path*' }))
  })

  it('redirects /connect to the homepage Connect Card launcher state', async () => {
    const redirects = await nextConfig.redirects?.()

    expect(redirects).toContainEqual({
      source: '/connect',
      destination: '/?launcher=connect',
      permanent: true,
    })
  })
})

describe('sermon media caching', () => {
  it('caches audio and artwork in browsers and Cloudflare for one year', async () => {
    const headers = await nextConfig.headers?.()
    const expectedCacheControl =
      'public, max-age=31536000, s-maxage=31536000, immutable'

    for (const source of [
      '/api/sermon-audio/file/:path*',
      '/api/media/file/:path*',
      '/images/ev_church_podcast-09e38534.jpg',
    ]) {
      expect(headers).toContainEqual({
        source,
        headers: [
          { key: 'Cache-Control', value: expectedCacheControl },
          {
            key: 'Cloudflare-CDN-Cache-Control',
            value: expectedCacheControl,
          },
        ],
      })
    }
  })
})

describe('Payload theme client hints', () => {
  it('limits color-scheme client hints to the Payload admin', async () => {
    const headers = await nextConfig.headers?.()
    const clientHintRules = headers?.filter((rule) =>
      rule.headers.some(
        ({ key, value }) =>
          ['Accept-CH', 'Critical-CH'].includes(key) &&
          value === 'Sec-CH-Prefers-Color-Scheme',
      ),
    )

    expect(clientHintRules).toHaveLength(1)
    expect(clientHintRules?.[0]?.source).toBe('/admin/:path*')
  })
})
