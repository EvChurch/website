// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { classifyRockHref, SafeRockHtml } from './SafeRockHtml'

describe('safe Rock HTML', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders untrusted server-side markup as escaped text when a DOM sanitizer is unavailable', () => {
    vi.stubGlobal('DOMParser', undefined)
    const markup = renderToStaticMarkup(
      <SafeRockHtml value={'<svg onload="steal()"><script>bad()</script></svg><p style="color:red">Thanks</p>'} />,
    )
    expect(markup).not.toContain('<svg')
    expect(markup).not.toContain('<script')
    expect(markup).not.toContain('onload=')
    expect(markup).not.toContain('style=')
    expect(markup).toContain('bad() Thanks')
  })

  it.each(['javascript:alert(1)', 'data:text/html,bad', 'http://evil.test/path', '//evil.test/path', 'https://name:secret@evil.test'])('rejects unsafe href %s', (href) => {
    expect(classifyRockHref(href, 'https://www.ev.church')).toBeNull()
  })

  it('distinguishes safe relative and external HTTPS links for hardened external attributes', () => {
    expect(classifyRockHref('/contact', 'https://www.ev.church')).toEqual({ href: '/contact', external: false })
    expect(classifyRockHref('https://example.test/help', 'https://www.ev.church')).toEqual({ href: 'https://example.test/help', external: true })
  })

  it('preserves trusted text headings and gives headings and paragraphs consistent spacing', () => {
    const markup = renderToStaticMarkup(
      <SafeRockHtml value="<h2>Welcome</h2><p>Tell us about yourself.</p>" />,
    )

    expect(markup).toContain('<h2>Welcome</h2>')
    expect(markup).toContain('[&amp;_h2]:my-5')
    expect(markup).toContain('[&amp;_p]:my-4')
  })

})
