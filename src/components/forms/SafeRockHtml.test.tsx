import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { classifyRockHref, SafeRockHtml } from './SafeRockHtml'

describe('safe Rock HTML', () => {
  it('renders untrusted server-side markup as escaped text when a DOM sanitizer is unavailable', () => {
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
})
