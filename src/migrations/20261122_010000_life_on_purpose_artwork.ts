import path from 'node:path'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

// Media and sermon-series are not exposed by the production Payload MCP.
// Replace only the two known low-resolution imports; preserve later editor changes.
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const result = await payload.find({
    collection: 'sermon-series', where: { slug: { equals: 'life-on-purpose' } },
    depth: 1, limit: 1, req,
  })
  const series = result.docs[0]
  if (!series) return

  const replacements = [
    { field: 'bannerImage', previous: 'life-on-purpose-banner.jpg', filename: 'life-on-purpose-banner-2026.jpg', alt: 'Life on Purpose series banner' },
    { field: 'backgroundImage', previous: 'life-on-purpose-background.png', filename: 'life-on-purpose-background-2026.jpg', alt: 'Life on Purpose background' },
  ] as const
  const data: { bannerImage?: number; backgroundImage?: number } = {}

  for (const replacement of replacements) {
    const current = series[replacement.field]
    if (!current || typeof current !== 'object' || current.filename !== replacement.previous) continue

    const existing = await payload.find({
      collection: 'media', where: { filename: { equals: replacement.filename } },
      depth: 0, limit: 1, req,
    })
    const media = existing.docs[0] ?? await payload.create({
      collection: 'media', req, context: { skipCacheInvalidation: true },
      data: { alt: replacement.alt },
      filePath: path.join(process.cwd(), 'public/sermons/life-on-purpose', replacement.filename),
    })
    data[replacement.field] = media.id
  }

  if (Object.keys(data).length > 0) {
    await payload.update({
      collection: 'sermon-series', id: series.id, data, req,
      context: { skipCacheInvalidation: true },
    })
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve artwork and any later editorial changes. Original media is retained.
}
