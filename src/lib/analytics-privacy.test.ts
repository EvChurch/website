import { describe, expect, it } from 'vitest'

import { canTrackAnalyticsPath } from './analytics-privacy'

describe('analytics privacy boundaries', () => {
  it.each([
    '/members',
    '/members/connect-groups/123',
    '/auth/pending',
    '/contact',
    '/contact/pastoral-care',
    '/give',
    '/give/return/status',
    '/member-auth/complete',
    '/member-avatar',
    '/member-sign-in/error',
    '/admin',
    '/api/health',
    '/privacy',
  ])('blocks analytics on sensitive route %s', (pathname) => {
    expect(canTrackAnalyticsPath(pathname)).toBe(false)
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
  ])('allows Google Analytics on a public route %s', (pathname) => {
    expect(canTrackAnalyticsPath(pathname)).toBe(true)
  })

  it.each([
    '/contactless',
    '/giveaway',
    '/privacy-policy',
  ])('keeps sensitive-prefix lookalike %s trackable', (pathname) => {
    expect(canTrackAnalyticsPath(pathname)).toBe(true)
  })

  it('allows Google Analytics on arbitrary CMS pages', () => {
    expect(canTrackAnalyticsPath('/about')).toBe(true)
  })
})
