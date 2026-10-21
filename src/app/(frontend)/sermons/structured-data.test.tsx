import { JSDOM } from 'jsdom'
import { Children, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const data = vi.hoisted(() => ({ sermon: vi.fn(), series: vi.fn() }))
vi.mock('@/lib/sermon-pages', () => ({ getSermonPageData: data.sermon, getSeriesPageData: data.series }))
vi.mock('@/lib/tracked-not-found', () => ({ trackedNotFound: vi.fn() }))
import SermonPage from './[slug]/page'
import SeriesPage from './series/[slug]/page'
import { SermonSeriesJsonLd } from '@/components/seo/SermonSeriesJsonLd'

const publishedAt = '2026-10-18T00:00:00.000Z'
const updatedAt = '2026-10-20T00:00:00.000Z'

function readJsonLd(markup: string) {
  const document = new JSDOM(markup).window.document
  return JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)
}

describe('sermon structured data', () => {
  it('describes the actual recording with CMS authors and dates and a stable publisher', async () => {
    data.sermon.mockResolvedValue({
      sermon: {
        id: 1, title: 'Psalm 27', slug: 'psalm-27', publishedAt, updatedAt,
        audioSpeaker: { name: 'Test speaker', slug: 'test-speaker' },
        audio: { url: 'https://media.example.test/psalm-27.mp3' }, duration: 125,
      },
      seriesDoc: null, prevSermon: null, nextSermon: null, moreBySeries: [],
    })
    const page = await SermonPage({ params: Promise.resolve({ slug: 'psalm-27' }) })
    const script = Children.toArray(page.props.children).find(child => isValidElement(child) && child.type === 'script')
    const markup = renderToStaticMarkup(<>{script}</>)
    const json = readJsonLd(markup)
    expect(json).toMatchObject({
      '@type': 'CreativeWork', '@id': 'https://www.ev.church/sermons/psalm-27#sermon',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.ev.church/sermons/psalm-27' },
      author: [{ '@type': 'Person', name: 'Test speaker' }], datePublished: publishedAt, dateModified: updatedAt,
      associatedMedia: { '@type': 'AudioObject', duration: 'PT125S', uploadDate: publishedAt },
      publisher: { '@id': 'https://www.ev.church/#organization' },
    })
  })

  it('does not fabricate audio, publication dates or authors when absent', async () => {
    data.sermon.mockResolvedValue({
      sermon: { id: 2, title: 'Video sermon', slug: 'video', updatedAt },
      seriesDoc: null, prevSermon: null, nextSermon: null, moreBySeries: [],
    })
    const page = await SermonPage({ params: Promise.resolve({ slug: 'video' }) })
    const script = Children.toArray(page.props.children).find(child => isValidElement(child) && child.type === 'script')
    const markup = renderToStaticMarkup(<>{script}</>)
    const json = readJsonLd(markup)
    expect(json).not.toHaveProperty('associatedMedia')
    expect(json).not.toHaveProperty('datePublished')
    expect(json).not.toHaveProperty('author')
  })

  it('renders a series collection on the actual series route with the displayed sermons', async () => {
    const series = { title: 'Living Hope', slug: 'living-hope', updatedAt }
    const sermons = [{ id: 1, title: 'Hope', slug: 'hope', publishedAt }]
    data.series.mockResolvedValue({ series, sermonsResult: { docs: sermons, totalDocs: 1 } })
    const page = await SeriesPage({ params: Promise.resolve({ slug: series.slug }) })
    const schema = Children.toArray(page.props.children).find(child => isValidElement(child) && child.type === SermonSeriesJsonLd)
    const markup = renderToStaticMarkup(<>{schema}</>)
    const json = readJsonLd(markup)
    expect(json).toMatchObject({
      '@type': 'CollectionPage', '@id': 'https://www.ev.church/sermons/series/living-hope',
      dateModified: updatedAt,
      mainEntity: {
        '@type': 'CreativeWorkSeries', '@id': 'https://www.ev.church/sermons/series/living-hope#series',
        hasPart: [{ '@type': 'CreativeWork', '@id': 'https://www.ev.church/sermons/hope#sermon', name: 'Hope', datePublished: publishedAt }],
      },
    })
  })

  it('escapes CMS content inside JSON-LD and omits missing publication dates', () => {
    const title = '</script><script>alert(1)</script>'
    const markup = renderToStaticMarkup(<SermonSeriesJsonLd
      series={{ title, slug: 'test', updatedAt }} sermons={[{ title, slug: 'test' }]} />)
    expect(new JSDOM(markup).window.document.querySelectorAll('script')).toHaveLength(1)
    const json = readJsonLd(markup)
    expect(json.name).toBe(title)
    expect(json.mainEntity.hasPart[0]).not.toHaveProperty('datePublished')
  })
})
