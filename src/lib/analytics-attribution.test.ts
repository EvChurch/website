import { describe, expect, it } from 'vitest'
import { getAnalyticsPageContext } from './analytics-attribution'

describe('analytics page context', () => {
  it('keeps campaign labels and click IDs without unrelated queries or fragments', () => {
    const context = getAnalyticsPageContext('https://www.ev.church/visit?utm_campaign=Visit+Auckland&gclid=AbC-123_456&email=person@example.com&code=private#form', '')
    expect(context).toEqual({
      page_location: 'https://www.ev.church/visit?utm_campaign=Visit+Auckland&gclid=AbC-123_456',
      page_path: '/visit', page_referrer: '',
    })
  })

  it('rejects email addresses, nested URLs and oversized campaign values', () => {
    const url = new URL('https://www.ev.church/visit')
    url.searchParams.set('utm_source', 'person@example.com')
    url.searchParams.set('utm_campaign', 'https://example.com/private')
    url.searchParams.set('utm_content', 'x'.repeat(101))
    url.searchParams.set('gclid', '<script>')
    expect(getAnalyticsPageContext(url.href, '')?.page_location).toBe('https://www.ev.church/visit')
  })

  it.each(['/give', '/contact', '/members/profile', '/auth/callback', '/shared/secret'])('preserves the privacy exclusion for %s', (path) => {
    expect(getAnalyticsPageContext(`https://www.ev.church${path}?gclid=test`, '')).toBeNull()
  })

  it('strips referrer paths and queries while retaining a legitimate referring source', () => {
    expect(getAnalyticsPageContext('https://www.ev.church/visit', 'https://example.org/private/name?email=secret')).toEqual({
      page_location: 'https://www.ev.church/visit', page_path: '/visit', page_referrer: 'https://example.org/',
    })
  })

  it.each(['accounts.google.com', 'secure.blinkpay.co.nz', 'sandbox.secure.blinkpay.co.nz', 'dev-xc16stsw52lzt8sa.us.auth0.com'])('ignores a service return from %s', (host) => {
    expect(getAnalyticsPageContext('https://www.ev.church/visit', `https://${host}/return?token=secret`)?.ignore_referrer).toBe(true)
  })

  it('does not treat a lookalike or other website as a service return', () => {
    expect(getAnalyticsPageContext('https://www.ev.church/visit', 'https://secure.blinkpay.co.nz.example.org/')?.ignore_referrer).toBeUndefined()
  })
})
