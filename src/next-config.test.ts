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
