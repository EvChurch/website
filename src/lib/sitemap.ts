import type { MetadataRoute } from 'next'

import { getPayloadClient } from '@/lib/payload'
import { isRetiredPageSlug } from '@/lib/public-pages'

export const SITE_URL = 'https://www.ev.church'

export interface SitemapLink {
  label: string
  url: string
  lastModified: Date
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

export interface SitemapSection {
  title: string
  links: SitemapLink[]
}

const REDIRECTING_PAGE_SLUGS = new Set(['give'])

function updatedAt(value?: string | null): Date {
  return value ? new Date(value) : new Date()
}

function link(
  label: string,
  path: string,
  options: Pick<SitemapLink, 'changeFrequency' | 'priority'> & { lastModified?: string | null },
): SitemapLink {
  return {
    label,
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    lastModified: updatedAt(options.lastModified),
    changeFrequency: options.changeFrequency,
    priority: options.priority,
  }
}

export async function getSitemapSections(): Promise<SitemapSection[]> {
  const payload = await getPayloadClient()

  const [pages, campuses, events, blogPosts, sermons, sermonSeries, speakers, topics, scriptures] = await Promise.all([
    payload.find({
    collection: 'pages',
    depth: 0,
    select: { title: true, slug: true, updatedAt: true },
    limit: 200,
    where: { _status: { equals: 'published' } },
    }),
    payload.find({
    collection: 'campuses',
    depth: 0,
    select: { name: true, slug: true, updatedAt: true },
    limit: 100,
    }),
    payload.find({
    collection: 'events',
    depth: 0,
    select: { title: true, slug: true, updatedAt: true },
    limit: 1000,
    }),
    payload.find({
    collection: 'blog-posts',
    depth: 0,
    select: { title: true, slug: true, updatedAt: true },
    limit: 1000,
    where: { _status: { equals: 'published' } },
    }),
    payload.find({
    collection: 'sermons',
    depth: 0,
    select: { title: true, slug: true, updatedAt: true },
    limit: 1000,
    where: { isPublished: { equals: true } },
    }),
    payload.find({
    collection: 'sermon-series',
    depth: 0,
    select: { title: true, slug: true, updatedAt: true },
    limit: 200,
    where: { isPublished: { equals: true } },
    }),
    payload.find({
    collection: 'speakers',
    depth: 0,
    select: { name: true, slug: true },
    limit: 200,
    }),
    payload.find({
    collection: 'topics',
    depth: 0,
    select: { name: true, slug: true },
    limit: 200,
    }),
    payload.find({
    collection: 'scriptures',
    depth: 0,
    select: { name: true, slug: true },
    limit: 200,
    }),
  ])

  return [
    {
      title: 'Pages',
      links: [
        ...pages.docs
          .filter((page) => !isRetiredPageSlug(page.slug) && !REDIRECTING_PAGE_SLUGS.has(page.slug))
          .map((page) => link(page.title, page.slug === 'home' ? '/' : `/${page.slug}`, {
            lastModified: page.updatedAt,
            changeFrequency: 'monthly',
            priority: page.slug === 'home' ? 1 : 0.7,
          })),
        link('Events', '/events', { changeFrequency: 'daily', priority: 0.9 }),
        link('North events', '/events/north', { changeFrequency: 'weekly', priority: 0.8 }),
        link('Central events', '/events/central', { changeFrequency: 'weekly', priority: 0.8 }),
        link('Unichurch events', '/events/unichurch', { changeFrequency: 'weekly', priority: 0.8 }),
        link('Blog', '/blog', { changeFrequency: 'weekly', priority: 0.6 }),
        link('Privacy policy', '/privacy', { changeFrequency: 'yearly', priority: 0.3 }),
        link('Health and safety', '/hs', { changeFrequency: 'yearly', priority: 0.3 }),
      ],
    },
    {
      title: 'Campuses',
      links: campuses.docs.map((campus) => link(campus.name, `/campus/${campus.slug}`, {
        lastModified: campus.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.8,
      })),
    },
    {
      title: 'Events',
      links: events.docs.map((event) => link(event.title, `/events/${event.slug}`, {
        lastModified: event.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
    },
    {
      title: 'Blog posts',
      links: blogPosts.docs.map((post) => link(post.title, `/blog/${post.slug}`, {
        lastModified: post.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      })),
    },
    {
      title: 'Sermons',
      links: [
        link('Sermons', '/sermons', { changeFrequency: 'weekly', priority: 0.9 }),
        ...sermons.docs.map((sermon) => link(sermon.title, `/sermons/${sermon.slug}`, {
          lastModified: sermon.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.7,
        })),
      ],
    },
    {
      title: 'Sermon series',
      links: sermonSeries.docs.map((series) => link(series.title, `/sermons/series/${series.slug}`, {
        lastModified: series.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.7,
      })),
    },
    {
      title: 'Sermon speakers',
      links: speakers.docs.map((speaker) => link(speaker.name, `/sermons/speakers/${speaker.slug}`, {
        changeFrequency: 'monthly',
        priority: 0.5,
      })),
    },
    {
      title: 'Sermon topics',
      links: topics.docs.map((topic) => link(topic.name, `/sermons/topics/${topic.slug}`, {
        changeFrequency: 'monthly',
        priority: 0.5,
      })),
    },
    {
      title: 'Scripture',
      links: scriptures.docs.map((scripture) => link(scripture.name, `/sermons/scriptures/${scripture.slug}`, {
        changeFrequency: 'monthly',
        priority: 0.5,
      })),
    },
  ]
}

export async function getXmlSitemap(): Promise<MetadataRoute.Sitemap> {
  const sections = await getSitemapSections()

  return [
    ...sections.flatMap((section) => section.links),
    link('Sitemap', '/sitemap', { changeFrequency: 'monthly', priority: 0.3 }),
  ].map(({ label: _label, ...entry }) => entry)
}
