import type { CollectionAfterChangeHook } from 'payload'

/** Renaming a tag must update the denormalized public sermon search index. */
export const reindexSermonTaxonomy: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  collection,
  req,
}) => {
  const name = collection.slug === 'sermon-series' ? 'title' : 'name'
  if (!previousDoc || previousDoc[name] === doc[name]) return doc
  const fields: Record<string, string> = {
    speakers: 'audioSpeaker',
    'sermon-series': 'series',
    topics: 'topics',
  }
  const field = fields[collection.slug]
  if (!field) return doc
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    const sermons = await req.payload.find({
      collection: 'sermons',
      where: { [field]: { equals: doc.id } },
      depth: 0,
      select: { title: true },
      page,
      limit: 100,
      req,
    })
    for (const sermon of sermons.docs) {
      await req.payload.update({
        collection: 'sermons',
        id: sermon.id,
        data: {},
        req,
        context: { reindexSermon: true, skipCacheInvalidation: true },
      })
    }
    hasNextPage = sermons.hasNextPage
    page++
  }
  return doc
}
