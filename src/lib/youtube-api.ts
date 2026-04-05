/**
 * YouTube Data API v3 client.
 *
 * Uses API key authentication (read-only, public channel data).
 * Follows the Rock API client pattern: typed interfaces, retry with
 * exponential backoff, custom error class, zero `any`.
 *
 * Quota-efficient: uses playlistItems.list (1 unit) instead of
 * search.list (100 units). Total cost per sync: 2-3 units.
 */

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || ''

export const YOUTUBE_CHANNELS = {
  central: process.env.YOUTUBE_CHANNEL_HANDLE_CENTRAL || '@ev.church',
  north: process.env.YOUTUBE_CHANNEL_HANDLE_NORTH || '@north.ev.church',
} as const

export type CampusKey = keyof typeof YOUTUBE_CHANNELS

// --- Response types ---

export interface YouTubeVideo {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string
  duration: string
  channelTitle: string
}

interface YouTubeChannelListResponse {
  items?: Array<{
    id: string
    contentDetails: {
      relatedPlaylists: {
        uploads: string
      }
    }
  }>
}

interface YouTubePlaylistItemsResponse {
  items?: Array<{
    snippet: {
      title: string
      publishedAt: string
      thumbnails: {
        high?: { url: string }
        medium?: { url: string }
        default?: { url: string }
      }
      resourceId: {
        videoId: string
      }
      channelTitle: string
    }
  }>
  nextPageToken?: string
}

interface YouTubeVideosResponse {
  items?: Array<{
    id: string
    contentDetails: {
      duration: string
    }
  }>
}

// --- Error class ---

export class YouTubeAPIError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`YouTube API error ${status} on ${endpoint}: ${message}`)
    this.name = 'YouTubeAPIError'
  }
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse ISO 8601 duration (e.g. PT1H30M15S) to seconds.
 */
export function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

async function youtubeFetch<T>(
  endpoint: string,
  params: Record<string, string>,
  retries = 3,
): Promise<T> {
  const url = new URL(`${YOUTUBE_API_URL}/${endpoint}`)
  url.searchParams.set('key', YOUTUBE_API_KEY)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
      })

      if (!response.ok) {
        throw new YouTubeAPIError(
          response.status,
          endpoint,
          await response.text(),
        )
      }

      return (await response.json()) as T
    } catch (error) {
      if (attempt === retries) throw error
      await sleep(1000 * Math.pow(2, attempt))
    }
  }

  throw new Error('Unreachable')
}

// --- Public API ---

/**
 * Resolve a YouTube channel handle (e.g. @ev.church) to a channel ID.
 * Caches the result in memory for the process lifetime.
 */
const channelIdCache = new Map<string, string>()

export async function resolveChannelId(handle: string): Promise<string> {
  const cached = channelIdCache.get(handle)
  if (cached) return cached

  const data = await youtubeFetch<YouTubeChannelListResponse>('channels', {
    part: 'contentDetails',
    forHandle: handle,
  })

  const channelId = data.items?.[0]?.id
  if (!channelId) {
    throw new YouTubeAPIError(404, 'channels', `No channel found for handle: ${handle}`)
  }

  channelIdCache.set(handle, channelId)
  return channelId
}

/**
 * Get the uploads playlist ID for a channel.
 * Derives from channel ID: UC... -> UU...
 */
export function getUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith('UC')) {
    return 'UU' + channelId.slice(2)
  }
  return channelId
}

/**
 * Fetch recent videos from a channel's uploads playlist.
 * Returns up to `maxResults` videos sorted newest-first.
 */
export async function fetchRecentUploads(
  handle: string,
  maxResults = 10,
): Promise<YouTubeVideo[]> {
  const channelId = await resolveChannelId(handle)
  const playlistId = getUploadsPlaylistId(channelId)

  // Step 1: Get playlist items (1 quota unit)
  const playlistData = await youtubeFetch<YouTubePlaylistItemsResponse>(
    'playlistItems',
    {
      part: 'snippet',
      playlistId,
      maxResults: String(maxResults),
    },
  )

  const items = playlistData.items || []
  if (items.length === 0) return []

  // Step 2: Get video durations (1 quota unit, batch up to 50)
  const videoIds = items.map((item) => item.snippet.resourceId.videoId)
  const videosData = await youtubeFetch<YouTubeVideosResponse>('videos', {
    part: 'contentDetails',
    id: videoIds.join(','),
  })

  const durationMap = new Map<string, string>()
  for (const video of videosData.items || []) {
    durationMap.set(video.id, video.contentDetails.duration)
  }

  // Combine playlist items with duration data
  return items.map((item) => {
    const videoId = item.snippet.resourceId.videoId
    const thumbnails = item.snippet.thumbnails
    return {
      videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '',
      duration: durationMap.get(videoId) || 'PT0S',
      channelTitle: item.snippet.channelTitle,
    }
  })
}

/**
 * Fetch recent videos from all configured campus channels.
 * Returns videos grouped by campus key.
 */
export async function fetchAllCampusVideos(
  maxResults = 50,
): Promise<Record<CampusKey, YouTubeVideo[]>> {
  const results: Record<CampusKey, YouTubeVideo[]> = {
    central: [],
    north: [],
  }

  const entries = Object.entries(YOUTUBE_CHANNELS) as Array<[CampusKey, string]>

  // Fetch in parallel for both campuses
  const fetches = entries.map(async ([campus, handle]) => {
    try {
      const videos = await fetchRecentUploads(handle, maxResults)
      results[campus] = videos
    } catch (error) {
      // Log but don't fail the entire sync if one campus errors
      console.error(`[YouTubeSync] Failed to fetch videos for ${campus}:`, error)
    }
  })

  await Promise.all(fetches)
  return results
}
