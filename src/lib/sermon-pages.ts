import { unstable_cache } from 'next/cache'
import { cache } from 'react'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getPayloadClient } from '@/lib/payload'

const LONG_REVALIDATE_SECONDS = 86_400

async function fetchSermonPageData(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'sermons',
    where: {
      and: [
        { slug: { equals: slug } },
        { isPublished: { equals: true } },
      ],
    },
    depth: 1,
    limit: 1,
  })
  const sermon = result.docs[0] ?? null

  if (!sermon) {
    return {
      sermon: null,
      seriesDoc: null,
      prevSermon: null,
      nextSermon: null,
      moreBySeries: [],
    }
  }

  const primarySeries = Array.isArray(sermon.series) &&
    sermon.series[0] &&
    typeof sermon.series[0] === 'object'
    ? sermon.series[0]
    : null
  const primarySeriesId = primarySeries?.id ?? null

  const seriesDocPromise = primarySeriesId
    ? payload.findByID({
        collection: 'sermon-series',
        id: primarySeriesId,
        depth: 1,
      })
    : Promise.resolve(null)

  const previousPromise = primarySeriesId && sermon.publishedAt
    ? payload.find({
        collection: 'sermons',
        where: {
          and: [
            { isPublished: { equals: true } },
            { series: { contains: primarySeriesId } },
            { publishedAt: { less_than: sermon.publishedAt } },
          ],
        },
        sort: '-publishedAt',
        limit: 1,
        depth: 0,
        select: { title: true, slug: true },
      })
    : Promise.resolve({ docs: [] })
  const nextPromise = primarySeriesId && sermon.publishedAt
    ? payload.find({
        collection: 'sermons',
        where: {
          and: [
            { isPublished: { equals: true } },
            { series: { contains: primarySeriesId } },
            { publishedAt: { greater_than: sermon.publishedAt } },
          ],
        },
        sort: 'publishedAt',
        limit: 1,
        depth: 0,
        select: { title: true, slug: true },
      })
    : Promise.resolve({ docs: [] })
  const moreBySeriesPromise = primarySeriesId
    ? payload.find({
        collection: 'sermons',
        where: {
          and: [
            { isPublished: { equals: true } },
            { series: { contains: primarySeriesId } },
            { id: { not_equals: sermon.id } },
          ],
        },
        sort: '-publishedAt',
        limit: 3,
        depth: 1,
      })
    : Promise.resolve({ docs: [] })

  const [seriesDoc, previousResult, nextResult, moreBySeriesResult] = await Promise.all([
    seriesDocPromise,
    previousPromise,
    nextPromise,
    moreBySeriesPromise,
  ])
  const previous = previousResult.docs[0]
  const next = nextResult.docs[0]

  return {
    sermon,
    seriesDoc,
    prevSermon: previous ? { title: previous.title, slug: previous.slug } : null,
    nextSermon: next ? { title: next.title, slug: next.slug } : null,
    moreBySeries: moreBySeriesResult.docs,
  }
}

async function fetchSeriesPageData(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'sermon-series',
    where: {
      and: [
        { slug: { equals: slug } },
        { isPublished: { equals: true } },
      ],
    },
    depth: 1,
    limit: 1,
  })
  const series = result.docs[0] ?? null

  if (!series) return { series: null, sermonsResult: null }

  const sermonsResult = await payload.find({
    collection: 'sermons',
    where: {
      and: [
        { isPublished: { equals: true } },
        { series: { contains: series.id } },
      ],
    },
    sort: '-publishedAt',
    limit: 200,
    depth: 2,
  })

  return { series, sermonsResult }
}

async function fetchSpeakerPageData(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'speakers',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
  })
  const speaker = result.docs[0] ?? null

  if (!speaker) return { speaker: null, sermonsResult: null }

  const sermonsResult = await payload.find({
    collection: 'sermons',
    where: {
      and: [
        { isPublished: { equals: true } },
        { or: [{ audioSpeaker: { equals: speaker.id } }, { 'videos.speaker': { equals: speaker.id } }] },
      ],
    },
    sort: '-publishedAt',
    limit: 200,
    depth: 2,
  })

  return { speaker, sermonsResult }
}

async function fetchTopicPageData(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'topics',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })
  const topic = result.docs[0] ?? null

  if (!topic) return { topic: null, sermonsResult: null }

  const sermonsResult = await payload.find({
    collection: 'sermons',
    where: {
      and: [
        { isPublished: { equals: true } },
        { topics: { contains: topic.id } },
      ],
    },
    sort: '-publishedAt',
    limit: 200,
    depth: 2,
  })

  return { topic, sermonsResult }
}

async function fetchScripturePageData(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'scriptures',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
  })
  const scripture = result.docs[0] ?? null

  if (!scripture) return { scripture: null, sermonsResult: null }

  const sermonsResult = await payload.find({
    collection: 'sermons',
    where: {
      and: [
        { isPublished: { equals: true } },
        { scriptures: { contains: scripture.id } },
      ],
    },
    sort: '-publishedAt',
    limit: 200,
    depth: 2,
  })

  return { scripture, sermonsResult }
}

const getCachedSermonPageData = unstable_cache(
  fetchSermonPageData,
  ['public-sermon-page-by-slug'],
  {
    tags: [
      CACHE_TAGS.sermons,
      CACHE_TAGS.sermonSeries,
      CACHE_TAGS.speakers,
      CACHE_TAGS.topics,
      CACHE_TAGS.scriptures,
    ],
    revalidate: LONG_REVALIDATE_SECONDS,
  },
)

const getCachedSeriesPageData = unstable_cache(
  fetchSeriesPageData,
  ['public-sermon-series-page-by-slug'],
  {
    tags: [CACHE_TAGS.sermons, CACHE_TAGS.sermonSeries],
    revalidate: LONG_REVALIDATE_SECONDS,
  },
)

const getCachedSpeakerPageData = unstable_cache(
  fetchSpeakerPageData,
  ['public-sermon-speaker-page-by-slug'],
  {
    tags: [CACHE_TAGS.sermons, CACHE_TAGS.speakers],
    revalidate: LONG_REVALIDATE_SECONDS,
  },
)

const getCachedTopicPageData = unstable_cache(
  fetchTopicPageData,
  ['public-sermon-topic-page-by-slug'],
  {
    tags: [CACHE_TAGS.sermons, CACHE_TAGS.topics, CACHE_TAGS.categories],
    revalidate: LONG_REVALIDATE_SECONDS,
  },
)

const getCachedScripturePageData = unstable_cache(
  fetchScripturePageData,
  ['public-sermon-scripture-page-by-slug'],
  {
    tags: [CACHE_TAGS.sermons, CACHE_TAGS.scriptures],
    revalidate: LONG_REVALIDATE_SECONDS,
  },
)

export const getSermonPageData = cache(getCachedSermonPageData)
export const getSeriesPageData = cache(getCachedSeriesPageData)
export const getSpeakerPageData = cache(getCachedSpeakerPageData)
export const getTopicPageData = cache(getCachedTopicPageData)
export const getScripturePageData = cache(getCachedScripturePageData)
