import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sitemapSections: vi.fn(),
}))

vi.mock('@/lib/sitemap', () => ({
  getSitemapSections: mocks.sitemapSections,
  SITE_URL: 'https://www.ev.church',
}))

import SitemapPage from './page'

describe('HTML sitemap page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders categorized crawlable links from the shared sitemap source', async () => {
    mocks.sitemapSections.mockResolvedValue([
      {
        title: 'Pages',
        links: [
          { label: 'About', url: 'https://www.ev.church/about' },
          { label: 'Contact', url: 'https://www.ev.church/contact' },
        ],
      },
      {
        title: 'Sermon topics',
        links: [
          {
            label: 'The Ministry of Christ',
            url: 'https://www.ev.church/sermons/topics/the-ministry-of-christ',
          },
        ],
      },
    ])

    const markup = renderToStaticMarkup(await SitemapPage())

    expect(markup).toContain('<h1')
    expect(markup).toContain('Sitemap</h1>')
    expect(markup).toContain('<h2')
    expect(markup).toContain('Pages</h2>')
    expect(markup).toContain('href="/about"')
    expect(markup).toContain('>About</a>')
    expect(markup).toContain('href="/contact"')
    expect(markup).toContain('Sermon topics</h2>')
    expect(markup).toContain('href="/sermons/topics/the-ministry-of-christ"')
    expect(markup).not.toContain('href="/sitemap"')
  })

  it('does not render empty sections', async () => {
    mocks.sitemapSections.mockResolvedValue([
      { title: 'Pages', links: [{ label: 'Home', url: 'https://www.ev.church' }] },
      { title: 'Events', links: [] },
    ])

    const markup = renderToStaticMarkup(await SitemapPage())

    expect(markup).toContain('Pages</h2>')
    expect(markup).not.toContain('Events</h2>')
  })
})
