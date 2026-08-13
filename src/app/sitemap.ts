import type { MetadataRoute } from 'next'

import { getXmlSitemap } from '@/lib/sitemap'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getXmlSitemap()
}
