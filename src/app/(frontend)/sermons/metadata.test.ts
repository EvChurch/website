import { describe, expect, it, vi } from 'vitest'
import auditedTitles from '@/lib/__fixtures__/ahrefs-sermon-titles.json'

const data = vi.hoisted(() => ({ sermon: vi.fn(), series: vi.fn() }))
vi.mock('@/lib/sermon-pages', () => ({ getSermonPageData: data.sermon, getSeriesPageData: data.series }))
vi.mock('@/lib/tracked-not-found', () => ({ trackedNotFound: vi.fn() }))

import { generateMetadata as sermonMetadata } from './[slug]/page'
import { generateMetadata as seriesMetadata } from './series/[slug]/page'

async function metadataFor(url: string, title: string) {
  const pathname = new URL(url).pathname
  const slug = pathname.split('/').at(-1)!
  const series = pathname.includes('/series/')
  const record = { title, slug }
  if (series) data.series.mockResolvedValue({ series: record })
  else data.sermon.mockResolvedValue({ sermon: record })
  return (series ? seriesMetadata : sermonMetadata)({ params: Promise.resolve({ slug }) })
}

describe('sermon metadata from the 21 October 2026 Ahrefs crawl', () => {
  it.each(auditedTitles)('keeps the final title within 70 characters for $url', async ({ url, title }) => {
    const metadata = await metadataFor(url, title)
    expect(metadata.title).toEqual({ absolute: expect.any(String) })
    const finalTitle = (metadata.title as { absolute: string }).absolute
    expect(finalTitle.length).toBeLessThanOrEqual(70)
    expect(finalTitle).toMatch(/ \| Ev Church$/)
    expect(finalTitle).not.toContain('Ev Church | Ev Church')
    expect(metadata.openGraph?.title).toBe(finalTitle)
    expect(metadata.alternates?.canonical).toBe(url.split('?')[0])
    expect(title.startsWith(finalTitle.split(' | ')[0].replace(/…$/, ''))).toBe(true)
  })

  it('retains distinctive titles across every canonical page', async () => {
    const canonicalPages = auditedTitles.filter(({ url }) => !new URL(url).search)
    const titles: string[] = []
    for (const { url, title } of canonicalPages) {
      const metadata = await metadataFor(url, title)
      titles.push((metadata.title as { absolute: string }).absolute)
    }
    expect(new Set(titles).size).toBe(canonicalPages.length)
  })
})
