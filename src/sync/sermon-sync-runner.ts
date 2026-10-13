import { getPayloadClient } from '@/lib/payload'
import { fetchAllPages } from '@/lib/resources-api'

const importContext = { churchResourcesImport: true, skipCacheInvalidation: true }

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
      context: importContext,
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
      context: importContext,
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

      if (existing.docs.length === 0) {
        await payload.create({ collection: 'categories', data: mapped, context: importContext })
        result.created++
      }
    }

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

      if (existing.docs.length === 0) {
        await payload.create({ collection: 'scriptures', data: mapped, context: importContext })
        result.created++
      }
    }

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

      if (existing.docs.length === 0) {
        await payload.create({ collection: 'speakers', data: mapped, context: importContext })
        result.created++
      }
    }

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

      if (existing.docs.length === 0) {
        await payload.create({ collection: 'topics', data: mapped, context: importContext })
        result.created++
      }
    }

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

    for (const series of allSeries) {
      const existing = await payload.find({
        collection: 'sermon-series',
        where: { resourceId: { equals: series.id } },
        depth: 0,
        limit: 1,
      })

      if (existing.docs.length > 0) continue

      // Download images only for new series.
      let backgroundImage: number | null = null
      let bannerImage: number | null = null
      let foregroundImage: number | null = null

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

      if (existing.docs.length === 0) {
        await payload.create({ collection: 'sermon-series', data: mapped, context: importContext })
        result.created++
      }
    }


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

    const sermons = await fetchAllPages<ResourceSermon>(sermonQuery, 'sermons', limit)

    // Pre-populate usedSlugs with existing DB slugs to avoid unique constraint violations
    const existingSermons = await payload.find({
      collection: 'sermons',
      pagination: false,
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

      if (existing.docs.length > 0) continue
      if (
        (sermon.authors.length > 0 && audioSpeakerId == null) ||
        seriesIds.length !== sermon.series.length ||
        topicIds.length !== sermon.topics.length ||
        scriptureIds.length !== sermon.scriptures.length
      ) {
        throw new Error('Sermon taxonomy is incomplete; import will retry.')
      }

      let audio: number | null = null
      let duration: number | null = null

      if (!audio && sermon.audioUrl) {
        const audioResult = await downloadAudio(sermon.audioUrl, `${slug}`)
        if (audioResult) {
          audio = audioResult.id
          duration = audioResult.duration
        }
      }

      if (!audio) throw new Error('Sermon audio could not be downloaded; import will retry.')

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

      try {
        await payload.create({ collection: 'sermons', data: mapped, context: importContext })
        result.created++
      } catch (error) {
        // Retry a rejected import without leaving another unreferenced audio upload.
        const references = await payload.find({
          collection: 'sermons', where: { audio: { equals: audio } }, depth: 0, limit: 1,
        })
        if (references.docs.length === 0) {
          await payload.delete({ collection: 'sermon-audio', id: audio, context: importContext })
        }
        throw error
      }
      } catch (error) {
        result.errors.push(`Sermon "${sermon.name}" (${sermon.id}): ${String(error)}`)
      }
    }


  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

/**
 * Import new sermon-related entities from resources.ev.church GraphQL API.
 * Existing Payload content is never updated or unpublished.
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
