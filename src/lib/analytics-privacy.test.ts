import { describe, expect, it } from 'vitest'

import {
  canTrackAnalyticsPath,
  canReplayPath,
} from './analytics-privacy'

describe('analytics privacy boundaries', () => {
  it.each([
    '/members',
    '/members/connect-groups/123',
    '/auth/pending',
    '/contact',
    '/contact/pastoral-care',
    '/give',
    '/member-auth/complete',
    '/member-avatar',
    '/member-sign-in/error',
    '/admin',
    '/api/health',
    '/privacy',
  ])('blocks analytics on sensitive route %s', (pathname) => {
    expect(canTrackAnalyticsPath(pathname)).toBe(false)
    expect(canReplayPath(pathname)).toBe(false)
  })

  it.each([
    '/',
    '/campus/north',
    '/events',
    '/events/easter-service',
    '/sermons',
    '/sermons/hope',
    '/blog/latest',
    '/hs',
  ])('allows replay only on a conservative public route %s', (pathname) => {
    expect(canTrackAnalyticsPath(pathname)).toBe(true)
    expect(canReplayPath(pathname)).toBe(true)
  })

  it('allows analytics but not replay on arbitrary CMS pages', () => {
    expect(canTrackAnalyticsPath('/about')).toBe(true)
    expect(canReplayPath('/about')).toBe(false)
  })
})
