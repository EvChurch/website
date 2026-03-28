import type { MetadataRoute } from 'next'
import { getPayloadClient } from '@/lib/payload'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ev.church'

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

  const pageRoutes: MetadataRoute.Sitemap = pages.docs.map((page) => ({
    url: page.slug === 'home' ? SITE_URL : `${SITE_URL}/${page.slug}`,
    lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: page.slug === 'home' ? 1 : 0.7,
  }))

  // Hardcoded pages (not in CMS)
  const hardcodedRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/what-we-believe`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
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

  return [...pageRoutes, ...hardcodedRoutes, ...campusRoutes, ...blogRoutes]
}
