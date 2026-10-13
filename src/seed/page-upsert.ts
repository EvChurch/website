import type { Payload } from 'payload'

export type PageSeedClient = Pick<Payload, 'find' | 'update' | 'create'>

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Create missing pages or replace every managed field with the authoritative seed. */
export function createPageUpserter(payload: PageSeedClient) {
  return async function upsertPage(slug: string, data: Record<string, unknown>) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    const canonicalData = {
      ...data,
      slug,
      template: data.template ?? 'standard',
      seo: {
        metaTitle: null,
        metaDescription: null,
        ogImage: null,
        ...record(data.seo),
      },
    }

    if (existing.docs.length > 0) {
      console.log(`  Updating page: ${slug}`)
      await payload.update({
        collection: 'pages',
        id: String(existing.docs[0].id),
        data: canonicalData,
        context: { skipCacheInvalidation: true },
      })
      return
    }

    console.log(`  Creating page: ${slug}`)
    await payload.create({
      collection: 'pages',
      data: canonicalData,
      context: { skipCacheInvalidation: true },
    })
  }
}
