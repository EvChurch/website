import { describe, expect, it } from 'vitest'

import { isCronRequestAuthorized } from './cron-auth'

describe('isCronRequestAuthorized', () => {
  const secret = 'test-secret'

  it('accepts a matching bearer token', () => {
    const request = new Request('https://example.com/api/sync/trigger', {
      headers: { Authorization: `Bearer ${secret}` },
    })

    expect(isCronRequestAuthorized(request, secret)).toBe(true)
  })

  it('keeps accepting the legacy query-string secret', () => {
    const request = new Request(
      `https://example.com/api/sync/trigger?secret=${secret}`,
    )

    expect(isCronRequestAuthorized(request, secret)).toBe(true)
  })

  it('rejects missing configuration and incorrect credentials', () => {
    const request = new Request('https://example.com/api/sync/trigger', {
      headers: { Authorization: 'Bearer incorrect' },
    })

    expect(isCronRequestAuthorized(request, '')).toBe(false)
    expect(isCronRequestAuthorized(request, secret)).toBe(false)
  })
})
