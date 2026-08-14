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
})
