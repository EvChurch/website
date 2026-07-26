import { getPayloadClient } from '@/lib/payload'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { fetchAllPages } from '@/lib/resources-api'

type SyncResult = {
  entity: string
  created: number
  updated: number
  deleted: number
  errors: string[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// GraphQL response types
interface ResourceAuthor {
  id: string
  name: string
}

interface ResourceCategory {
  id: string
  name: string
}

interface ResourceTopic {
  id: string
  name: string
  category: ResourceCategory
}

interface ResourceScripture {
  id: string
  name: string
}

interface ResourceSeries {
  id: string
  name: string
  backgroundUrl: string | null
  bannerUrl: string | null
  foregroundUrl: string | null
}

interface ResourceSermonScripture {
  range: string | null
  scripture: { name: string }
}

interface ResourceSermon {
  id: string
  name: string
  publishedAt: string | null
  audioUrl: string | null
  backgroundUrl: string | null
  bannerUrl: string | null
  foregroundUrl: string | null
  authors: ResourceAuthor[]
  series: ResourceSeries[]
  topics: ResourceTopic[]
  scriptures: ResourceScripture[]
  sermonScriptures: ResourceSermonScripture[]
}

/**
 * Downloads an image from a URL and creates a Media document in Payload.
 * Returns the Payload media document ID, or null on failure.
 */
async function downloadImage(
  url: string,
  filename: string,
): Promise<number | null> {
  try {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? '.png' : '.jpg'

    const payload = await getPayloadClient()
    const media = await payload.create({
      collection: 'media',
      data: {
        alt: filename,
      },
      file: {
        data: buffer,
        mimetype: contentType,
        name: `${slugify(filename)}${ext}`,
        size: buffer.length,
      },
    })

    return media.id
  } catch {
    return null
  }
}

/**
 * Downloads an audio file from a URL and creates a SermonAudio document in Payload.
 * Also extracts duration from the M4A headers.
 * Returns { id, duration } or null on failure.
 */
async function downloadAudio(
  url: string,
  filename: string,
): Promise<{ id: number; duration: number | null } | null> {
  try {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType =
      response.headers.get('content-type') || 'audio/x-m4a'

    // Extract duration from the downloaded buffer
    const duration = extractDurationFromBuffer(buffer)

    const payload = await getPayloadClient()
    const audio = await payload.create({
      collection: 'sermon-audio',
      data: {
        duration,
      },
      file: {
        data: buffer,
        mimetype: contentType,
        name: `${slugify(filename)}.m4a`,
        size: buffer.length,
      },
    })

    return { id: audio.id, duration }
  } catch {
    return null
  }
}

/**
 * Extract duration from an M4A buffer by parsing the moov/mvhd atom.
 */
function extractDurationFromBuffer(buffer: Buffer): number | null {
  for (let i = 0; i < buffer.length - 20; i++) {
    if (
      buffer[i] === 0x6d &&
      buffer[i + 1] === 0x76 &&
      buffer[i + 2] === 0x68 &&
      buffer[i + 3] === 0x64
    ) {
      const version = buffer[i + 4]
      if (version === 0) {
        const timescale = buffer.readUInt32BE(i + 16)
        const dur = buffer.readUInt32BE(i + 20)
        if (timescale > 0) return Math.round(dur / timescale)
      } else if (version === 1) {
        const timescale = buffer.readUInt32BE(i + 20)
        const high = buffer.readUInt32BE(i + 24)
        const low = buffer.readUInt32BE(i + 28)
        const dur = high * 0x100000000 + low
        if (timescale > 0) return Math.round(dur / timescale)
      }
      break
    }
  }
  return null
}

async function syncCategories(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'categories',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const payload = await getPayloadClient()
    const categories = await fetchAllPages<ResourceCategory>(
      '{ categories(first: 100, after: $cursor) { nodes { id name } pageInfo { hasNextPage endCursor } } }',
      'categories',
    )

    for (const cat of categories) {
      const mapped = {
        name: cat.name,
        slug: slugify(cat.name),
        resourceId: cat.id,
        lastSyncedAt: new Date().toISOString(),
      }

      const existing = await payload.find({
        collection: 'categories',
        where: { resourceId: { equals: cat.id } },
        depth: 0,
        limit: 1,
      })

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'categories',
          id: existing.docs[0].id,
          data: mapped,
        })
        result.updated++
      } else {
        await payload.create({ collection: 'categories', data: mapped })
        result.created++
      }
    }

    revalidateTag(CACHE_TAGS.categories, 'default')
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

async function syncScriptures(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'scriptures',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const payload = await getPayloadClient()
    const scriptures = await fetchAllPages<ResourceScripture>(
      '{ scriptures(first: 100, after: $cursor) { nodes { id name } pageInfo { hasNextPage endCursor } } }',
      'scriptures',
    )

    for (const scripture of scriptures) {
      const mapped = {
        name: scripture.name,
        slug: slugify(scripture.name),
        resourceId: scripture.id,
        lastSyncedAt: new Date().toISOString(),
      }

      const existing = await payload.find({
        collection: 'scriptures',
        where: { resourceId: { equals: scripture.id } },
        depth: 0,
        limit: 1,
      })

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'scriptures',
          id: existing.docs[0].id,
          data: mapped,
        })
        result.updated++
      } else {
        await payload.create({ collection: 'scriptures', data: mapped })
        result.created++
      }
    }

    revalidateTag(CACHE_TAGS.scriptures, 'default')
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

async function syncSpeakers(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'speakers',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const payload = await getPayloadClient()
    const authors = await fetchAllPages<ResourceAuthor>(
      '{ authors(first: 100, after: $cursor) { nodes { id name } pageInfo { hasNextPage endCursor } } }',
      'authors',
    )

    for (const author of authors) {
      const mapped = {
        name: author.name,
        slug: slugify(author.name),
        resourceId: author.id,
        lastSyncedAt: new Date().toISOString(),
      }

      const existing = await payload.find({
        collection: 'speakers',
        where: { resourceId: { equals: author.id } },
        depth: 0,
        limit: 1,
      })

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'speakers',
          id: existing.docs[0].id,
          data: mapped,
        })
        result.updated++
      } else {
        await payload.create({ collection: 'speakers', data: mapped })
        result.created++
      }
    }

    revalidateTag(CACHE_TAGS.speakers, 'default')
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

async function syncTopics(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'topics',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const payload = await getPayloadClient()

    // Build category resourceId -> Payload ID map
    const allCategories = await payload.find({
      collection: 'categories',
      limit: 100,
      depth: 0,
    })
    const categoryMap = new Map<string, number>()
    for (const cat of allCategories.docs) {
      categoryMap.set(cat.resourceId, cat.id)
    }

    const topics = await fetchAllPages<ResourceTopic>(
      '{ topics(first: 100, after: $cursor) { nodes { id name category { id } } pageInfo { hasNextPage endCursor } } }',
      'topics',
    )

    for (const topic of topics) {
      const categoryPayloadId = categoryMap.get(topic.category.id) || null

      const mapped = {
        name: topic.name,
        slug: slugify(topic.name),
        resourceId: topic.id,
        category: categoryPayloadId,
        lastSyncedAt: new Date().toISOString(),
      }

      const existing = await payload.find({
        collection: 'topics',
        where: { resourceId: { equals: topic.id } },
        depth: 0,
        limit: 1,
      })

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'topics',
          id: existing.docs[0].id,
          data: mapped,
        })
        result.updated++
      } else {
        await payload.create({ collection: 'topics', data: mapped })
        result.created++
      }
    }

    revalidateTag(CACHE_TAGS.topics, 'default')
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

async function syncSermonSeries(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'sermon-series',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const payload = await getPayloadClient()
    const allSeries = await fetchAllPages<ResourceSeries>(
      '{ series(first: 100, after: $cursor) { nodes { id name backgroundUrl bannerUrl foregroundUrl } pageInfo { hasNextPage endCursor } } }',
      'series',
    )

    const syncedIds = new Set<string>()

    for (const series of allSeries) {
      syncedIds.add(series.id)

      const existing = await payload.find({
        collection: 'sermon-series',
        where: { resourceId: { equals: series.id } },
        depth: 0,
        limit: 1,
      })

      // Use existing images if already downloaded, otherwise download
      const existingDoc = existing.docs[0]
      let backgroundImage = (existingDoc?.backgroundImage as number | null) || null
      let bannerImage = (existingDoc?.bannerImage as number | null) || null
      let foregroundImage = (existingDoc?.foregroundImage as number | null) || null

      if (!backgroundImage && series.backgroundUrl) {
        backgroundImage = await downloadImage(
          series.backgroundUrl,
          `${series.name} background`,
        )
      }
      if (!bannerImage) {
        // Try bannerUrl first, fall back to backgroundUrl
        if (series.bannerUrl) {
          bannerImage = await downloadImage(
            series.bannerUrl,
            `${series.name} banner`,
          )
        }
        if (!bannerImage && series.backgroundUrl) {
          bannerImage = await downloadImage(
            series.backgroundUrl,
            `${series.name} banner`,
          )
        }
      }
      if (!foregroundImage && series.foregroundUrl) {
        foregroundImage = await downloadImage(
          series.foregroundUrl,
          `${series.name} foreground`,
        )
      }

      const mapped = {
        title: series.name,
        slug: slugify(series.name),
        resourceId: series.id,
        backgroundImage,
        bannerImage,
        foregroundImage,
        isPublished: true,
        lastSyncedAt: new Date().toISOString(),
      }

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'sermon-series',
          id: existing.docs[0].id,
          data: mapped,
        })
        result.updated++
      } else {
        await payload.create({ collection: 'sermon-series', data: mapped })
        result.created++
      }
    }

    // Soft-delete series not in API response
    const allPayloadSeries = await payload.find({
      collection: 'sermon-series',
      limit: 500,
      depth: 0,
      where: { isPublished: { equals: true } },
    })
    for (const doc of allPayloadSeries.docs) {
      if (doc.resourceId && !syncedIds.has(doc.resourceId)) {
        await payload.update({
          collection: 'sermon-series',
          id: doc.id,
          data: { isPublished: false },
        })
        result.deleted++
      }
    }

    revalidateTag(CACHE_TAGS.sermonSeries, 'default')
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

async function syncSermons(limit?: number): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'sermons',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const payload = await getPayloadClient()

    // Build relationship maps: resourceId -> Payload ID
    const [allSeries, allSpeakers, allTopics, allScriptures] =
      await Promise.all([
        payload.find({
          collection: 'sermon-series',
          limit: 500,
          depth: 0,
          select: { resourceId: true },
        }),
        payload.find({
          collection: 'speakers',
          limit: 500,
          depth: 0,
          select: { resourceId: true },
        }),
        payload.find({
          collection: 'topics',
          limit: 500,
          depth: 0,
          select: { resourceId: true },
        }),
        payload.find({
          collection: 'scriptures',
          limit: 500,
          depth: 0,
          select: { resourceId: true },
        }),
      ])

    const seriesMap = new Map<string, number>()
    for (const doc of allSeries.docs) {
      if (doc.resourceId) seriesMap.set(doc.resourceId, doc.id)
    }
    const speakerMap = new Map<string, number>()
    for (const doc of allSpeakers.docs) {
      if (doc.resourceId) speakerMap.set(doc.resourceId, doc.id)
    }
    const topicMap = new Map<string, number>()
    for (const doc of allTopics.docs) {
      if (doc.resourceId) topicMap.set(doc.resourceId, doc.id)
    }
    const scriptureMap = new Map<string, number>()
    for (const doc of allScriptures.docs) {
      if (doc.resourceId) scriptureMap.set(doc.resourceId, doc.id)
    }

    // Also build a series resourceId -> slug map for sermon slug generation
    const seriesSlugMap = new Map<string, string>()
    const allSeriesFull = await payload.find({
      collection: 'sermon-series',
      limit: 500,
      depth: 0,
      select: { resourceId: true, slug: true },
    })
    for (const doc of allSeriesFull.docs) {
      if (doc.resourceId && doc.slug) seriesSlugMap.set(doc.resourceId, doc.slug)
    }

    const pageSize = Math.min(limit || 25, 25)
    const sermonQuery = `{ sermons(first: ${pageSize}, after: $cursor) {
        nodes {
          id name publishedAt audioUrl
          authors { id name }
          series { id name }
          topics { id name }
          scriptures { id name }
          sermonScriptures { range scripture { name } }
        }
        pageInfo { hasNextPage endCursor }
      } }`

    let sermons = await fetchAllPages<ResourceSermon>(sermonQuery, 'sermons', limit)

    const syncedIds = new Set<string>()

    // Pre-populate usedSlugs with existing DB slugs to avoid unique constraint violations
    const existingSermons = await payload.find({
      collection: 'sermons',
      limit: 10000,
      depth: 0,
      select: { slug: true, resourceId: true },
    })
    const usedSlugs = new Set<string>(
      existingSermons.docs.map((doc) => doc.slug).filter(Boolean),
    )
    const existingSlugMap = new Map<string, string>()
    for (const doc of existingSermons.docs) {
      if (doc.resourceId && doc.slug) existingSlugMap.set(doc.resourceId, doc.slug)
    }

    for (const sermon of sermons) {
      try {
      syncedIds.add(sermon.id)

      // Reuse existing slug for known sermons, generate for new ones
      let slug = existingSlugMap.get(sermon.id)
      if (!slug) {
        const seriesSlug =
          sermon.series.length > 0
            ? seriesSlugMap.get(sermon.series[0].id)
            : null
        const titleSlug = slugify(sermon.name)
        slug = seriesSlug ? `${seriesSlug}-${titleSlug}` : titleSlug

        // Ensure slug uniqueness by appending resource ID suffix on collision
        if (!slug || usedSlugs.has(slug)) {
          slug = slug ? `${slug}-${sermon.id}` : `sermon-${sermon.id}`
        }
      }
      usedSlugs.add(slug)

      // Resolve relationships
      const seriesIds = sermon.series
        .map((s) => seriesMap.get(s.id))
        .filter((id): id is number => id != null)
      const audioSpeakerId = sermon.authors.length > 0
        ? speakerMap.get(sermon.authors[0].id) ?? null
        : null
      const topicIds = sermon.topics
        .map((t) => topicMap.get(t.id))
        .filter((id): id is number => id != null)
      const scriptureIds = sermon.scriptures
        .map((s) => scriptureMap.get(s.id))
        .filter((id): id is number => id != null)

      // Build passage reference from sermonScriptures (e.g., "John 7")
      const passageReference = sermon.sermonScriptures
        .map((ss) => {
          const book = ss.scripture.name
          return ss.range ? `${book} ${ss.range}` : book
        })
        .join(', ')

      // Build denormalized search text from all related names
      const searchText = [
        sermon.name,
        ...sermon.authors.map((a) => a.name),
        ...sermon.series.map((s) => s.name),
        ...sermon.topics.map((t) => t.name),
        ...sermon.scriptures.map((s) => s.name),
        passageReference,
      ].join(' ')

      const existing = await payload.find({
        collection: 'sermons',
        where: { resourceId: { equals: sermon.id } },
        depth: 0,
        limit: 1,
      })

      const isNew = existing.docs.length === 0

      // Download audio only on first creation, keep existing on updates
      let audio: number | null = null
      let duration: number | null = null

      if (!isNew) {
        const doc = existing.docs[0]
        audio = (doc.audio as number) || null
        duration = doc.duration || null
      }

      if (!audio && sermon.audioUrl) {
        const audioResult = await downloadAudio(sermon.audioUrl, `${slug}`)
        if (audioResult) {
          audio = audioResult.id
          duration = audioResult.duration
        }
      }

      const mapped = {
        title: sermon.name,
        slug,
        resourceId: sermon.id,
        audio,
        publishedAt: sermon.publishedAt,
        duration,
        series: seriesIds,
        audioSpeaker: audioSpeakerId,
        topics: topicIds,
        scriptures: scriptureIds,
        passageReference: passageReference || null,
        searchText,
        isPublished: true,
        lastSyncedAt: new Date().toISOString(),
      }

      if (!isNew) {
        await payload.update({
          collection: 'sermons',
          id: existing.docs[0].id,
          data: mapped,
        })
        result.updated++
      } else {
        await payload.create({ collection: 'sermons', data: mapped })
        result.created++
      }
      } catch (error) {
        result.errors.push(`Sermon "${sermon.name}" (${sermon.id}): ${String(error)}`)
      }
    }

    // Soft-delete sermons not in API response (only during full sync, not limited)
    if (!limit) {
    let page = 1
    let hasMore = true
    while (hasMore) {
      const batch = await payload.find({
        collection: 'sermons',
        limit: 100,
        page,
        depth: 0,
        where: { isPublished: { equals: true } },
      })
      for (const doc of batch.docs) {
        if (doc.resourceId && !syncedIds.has(doc.resourceId)) {
          await payload.update({
            collection: 'sermons',
            id: doc.id,
            data: { isPublished: false },
          })
          result.deleted++
        }
      }
      hasMore = batch.hasNextPage
      page++
    }
    } // end soft-delete (full sync only)

    revalidateTag(CACHE_TAGS.sermons, 'default')
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

/**
 * Full sync for all sermon-related entities from resources.ev.church GraphQL API.
 * Sync order matters: dependencies first, then sermons last.
 *
 * @param limit - If set, only sync the first N sermons (for development). Taxonomy entities always sync fully.
 */
export async function runSermonSync(limit?: number): Promise<SyncResult[]> {
  const results: SyncResult[] = []

  // Phase 1: Independent entities (no relationships)
  results.push(await syncCategories())
  results.push(await syncScriptures())
  results.push(await syncSpeakers())

  // Phase 2: Entities with relationships to Phase 1
  results.push(await syncTopics())
  results.push(await syncSermonSeries())

  // Phase 3: Sermons depend on all above
  results.push(await syncSermons(limit))

  return results
}
