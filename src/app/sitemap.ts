import type { MetadataRoute } from 'next'

import { getXmlSitemap } from '@/lib/sitemap'

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getXmlSitemap()
}
