import { describe, expect, it } from 'vitest'

import {
  isEligiblePublicPath,
  isTrackableMissingPath,
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
      '/contact',
      '/contact/pastoral-care',
      '/give',
      '/privacy',
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
      '/authorization',
      '/contactless',
      '/giveaway',
      '/privacy-policy',
    ])('keeps eligible or prefix-lookalike path %s', (pathname) => {
      expect(isEligiblePublicPath(pathname)).toBe(true)
    })
  })

  describe('trusted public path header transport', () => {
    it.each([
      ['/māori/whānau', '%2Fm%C4%81ori%2Fwh%C4%81nau'],
      ['/church/教会', '%2Fchurch%2F%E6%95%99%E4%BC%9A'],
    ])('round trips %s through an ASCII-safe value', async (path, encoded) => {
      const { decodePublicPathHeader, encodePublicPathHeader } = await import(
        './public-paths'
      )
      expect(encodePublicPathHeader(path)).toBe(encoded)
      expect(decodePublicPathHeader(encoded)).toBe(path)
    })
  })

  describe('isTrackableMissingPath', () => {
    it.each([
      '/',
      '/members/connect-groups/123',
      '/api/admin/rock-forms',
      '/events/missing/calendar.ics',
      '/images/missing.svg',
    ])('tracks normalized 404 path %s', (pathname) => {
      expect(isTrackableMissingPath(pathname)).toBe(true)
    })

    it.each(['', '//example.com/path', '/path\\escape', '/path/%2fescape'])(
      'rejects unsafe tracking path %j',
      (pathname) => {
        expect(isTrackableMissingPath(pathname)).toBe(false)
      },
    )
  })

  describe('parseInternalRedirectDestination', () => {
    it.each([
      ['/', '/'],
      ['/kids', '/kids'],
      ['/community/kids/', '/community/kids'],
      ['/?launcher=reimbursement', '/?launcher=reimbursement'],
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
      '/?launcher=',
      '/?launcher=Reimbursement',
      '/?launcher=reimbursement&from=old',
      '/?launcher=reimbursement#details',
      '/?launcher=reimbursement&launcher=kids-enrolment',
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
