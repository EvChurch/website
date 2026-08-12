import type { MetadataRoute } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { isRetiredPageSlug } from '@/lib/public-pages'

export const dynamic = 'force-dynamic'

const SITE_URL = 'https://www.ev.church'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient()

  // Dynamic CMS-managed pages
  const pages = await payload.find({
    collection: 'pages',
    depth: 0,
    select: { slug: true, updatedAt: true },
    limit: 200,
    where: { _status: { equals: 'published' } },
  })

  const pageRoutes: MetadataRoute.Sitemap = pages.docs
    .filter((page) => !isRetiredPageSlug(page.slug))
    .map((page) => ({
      url: page.slug === 'home' ? SITE_URL : `${SITE_URL}/${page.slug}`,
      lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: page.slug === 'home' ? 1 : 0.7,
    }))

  // Hardcoded pages (not CMS-managed)
  const hardcodedRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/events`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/events/north`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/events/central`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/events/unichurch`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/hs`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Dynamic campus routes
  const campuses = await payload.find({
    collection: 'campuses',
    depth: 0,
    select: { slug: true, updatedAt: true },
    limit: 100,
  })

  const campusRoutes: MetadataRoute.Sitemap = campuses.docs.map((campus) => ({
    url: `${SITE_URL}/campus/${campus.slug}`,
    lastModified: campus.updatedAt ? new Date(campus.updatedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  const events = await payload.find({
    collection: 'events',
    depth: 0,
    select: { slug: true, updatedAt: true },
    limit: 1000,
  })

  const eventRoutes: MetadataRoute.Sitemap = events.docs.map((event) => ({
    url: `${SITE_URL}/events/${event.slug}`,
    lastModified: event.updatedAt ? new Date(event.updatedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Dynamic blog post routes
  const blogPosts = await payload.find({
    collection: 'blog-posts',
    depth: 0,
    select: { slug: true, updatedAt: true },
    limit: 1000,
    where: { _status: { equals: 'published' } },
  })

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.docs.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // Sermon routes
  const sermons = await payload.find({
    collection: 'sermons',
    depth: 0,
    select: { slug: true, updatedAt: true },
    limit: 1000,
    where: { isPublished: { equals: true } },
  })

  const sermonRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/sermons`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    ...sermons.docs.map((sermon) => ({
      url: `${SITE_URL}/sermons/${sermon.slug}`,
      lastModified: sermon.updatedAt ? new Date(sermon.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]

  const sermonSeries = await payload.find({
    collection: 'sermon-series',
    depth: 0,
    select: { slug: true, updatedAt: true },
    limit: 200,
    where: { isPublished: { equals: true } },
  })

  const seriesRoutes: MetadataRoute.Sitemap = sermonSeries.docs.map((s) => ({
    url: `${SITE_URL}/sermons/series/${s.slug}`,
    lastModified: s.updatedAt ? new Date(s.updatedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const speakers = await payload.find({
    collection: 'speakers',
    depth: 0,
    select: { slug: true },
    limit: 200,
  })

  const speakerRoutes: MetadataRoute.Sitemap = speakers.docs.map((sp) => ({
    url: `${SITE_URL}/sermons/speakers/${sp.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  const topics = await payload.find({
    collection: 'topics',
    depth: 0,
    select: { slug: true },
    limit: 200,
  })

  const topicRoutes: MetadataRoute.Sitemap = topics.docs.map((t) => ({
    url: `${SITE_URL}/sermons/topics/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  const scriptures = await payload.find({
    collection: 'scriptures',
    depth: 0,
    select: { slug: true },
    limit: 200,
  })

  const scriptureRoutes: MetadataRoute.Sitemap = scriptures.docs.map((sc) => ({
    url: `${SITE_URL}/sermons/scriptures/${sc.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [
    ...pageRoutes,
    ...hardcodedRoutes,
    ...campusRoutes,
    ...eventRoutes,
    ...blogRoutes,
    ...sermonRoutes,
    ...seriesRoutes,
    ...speakerRoutes,
    ...topicRoutes,
    ...scriptureRoutes,
  ]
}
