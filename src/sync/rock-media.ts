import type { Payload } from 'payload'

import { rockFetchImage } from '@/lib/rock-api'

export function extractRockImageGuid(photoUrl: string): string | null {
  try {
    const url = new URL(photoUrl, 'https://rock.ev.church')
    for (const [key, value] of url.searchParams) {
      if (key.toLowerCase() === 'guid' && value) return value
    }
  } catch {
    return null
  }
  return null
}

export async function syncRockImage({
  payload,
  photoUrl,
  alt,
}: {
  payload: Payload
  photoUrl: string
  alt: string
}): Promise<number | null> {
  const guid = extractRockImageGuid(photoUrl)
  if (!guid) return null

  const existing = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 1,
    where: { rockImageGuid: { equals: guid } },
  })
  if (existing.docs[0]) return existing.docs[0].id

  const image = await rockFetchImage(guid, 1920)
  if (!image) return null

  const extension = image.contentType.includes('png')
    ? 'png'
    : image.contentType.includes('webp')
      ? 'webp'
      : image.contentType.includes('gif')
        ? 'gif'
        : 'jpg'
  const filename = `${alt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${guid}.${extension}`
  const media = await payload.create({
    collection: 'media',
    data: { alt, rockImageGuid: guid },
    context: { skipCacheInvalidation: true },
    file: {
      data: image.buffer,
      mimetype: image.contentType,
      name: filename,
      size: image.buffer.length,
    },
  })

  return media.id
}
