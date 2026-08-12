import { describe, expect, it } from 'vitest'

import {
  isEligiblePublicPath,
  normalizePublicPath,
  parseInternalRedirectDestination,
} from './public-paths'

describe('public path policy', () => {
  describe('normalizePublicPath', () => {
    it.each([
      ['/community/kids/club/', '/community/kids/club'],
      ['/community/kids/club/?utm_source=ahrefs', '/community/kids/club'],
      ['https://www.ev.church/community/kids/club/?utm_source=ahrefs', '/community/kids/club'],
      ['/', '/'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizePublicPath(input)).toBe(expected)
    })

    it.each([
      '',
      'community/kids',
      '//example.com/kids',
      '/community\\kids',
      '/community//kids',
      '/community/../kids',
      '/community/%2e%2e/kids',
      '/community/%2fadmin',
      '/community/%5cadmin',
      '/community/%zz',
      '/community/\u0000kids',
    ])('rejects malformed or structurally ambiguous input %j', (input) => {
      expect(normalizePublicPath(input)).toBeNull()
    })
  })

  describe('isEligiblePublicPath', () => {
    it.each([
      '/members',
      '/members/connect-groups/123',
      '/admin',
      '/api/health',
      '/auth/login',
      '/member-auth/complete',
      '/member-avatar',
      '/member-sign-in/error',
      '/_next/static/chunk.js',
      '/robots.txt',
      '/sitemap.xml',
      '/favicon.ico',
      '/apple-icon.png',
      '/images/logo.svg',
      '/downloads/guide.pdf',
    ])('excludes non-public or asset path %s', (pathname) => {
      expect(isEligiblePublicPath(pathname)).toBe(false)
    })

    it.each([
      '/',
      '/events',
      '/community/kids/club',
      '/memberships',
      '/administrator',
      '/apiary',
    ])('keeps eligible or prefix-lookalike path %s', (pathname) => {
      expect(isEligiblePublicPath(pathname)).toBe(true)
    })
  })

  describe('parseInternalRedirectDestination', () => {
    it.each([
      ['/', '/'],
      ['/kids', '/kids'],
      ['/community/kids/', '/community/kids'],
    ])('accepts canonical internal destination %s', (input, expected) => {
      expect(parseInternalRedirectDestination(input)).toBe(expected)
    })

    it.each([
      '',
      'kids',
      'https://example.com/kids',
      '//example.com/kids',
      '/kids\\archive',
      '/kids?from=old',
      '/kids#details',
      '#details',
      '?from=old',
      '/%2f%2fevil.example',
      '/%5cevil.example',
      '/kids\u0000',
    ])('rejects unsafe redirect destination %j', (input) => {
      expect(parseInternalRedirectDestination(input)).toBeNull()
    })
  })
})
