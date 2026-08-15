import { unstable_cache } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getPayloadClient } from '@/lib/payload'

async function fetchLatestSermonWithSeries() {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'sermons',
    where: { isPublished: { equals: true } },
    sort: '-publishedAt',
    limit: 1,
    depth: 1,
  })

  const sermon = result.docs[0]
  if (!sermon) return null

  const series = Array.isArray(sermon.series) &&
    sermon.series[0] &&
    typeof sermon.series[0] === 'object'
    ? sermon.series[0]
    : null
  const seriesDoc = series
    ? await payload.findByID({
        collection: 'sermon-series',
        id: series.id,
        depth: 1,
      })
    : null

  return { sermon, seriesDoc }
}

export const getLatestSermonWithSeries = unstable_cache(
  fetchLatestSermonWithSeries,
  ['latest-sermon-with-series'],
  {
    tags: [CACHE_TAGS.sermons, CACHE_TAGS.sermonSeries],
    revalidate: 3_600,
  },
)
