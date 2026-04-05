/**
 * YouTube-to-sermon matching logic.
 *
 * Matches YouTube videos from campus channels to existing sermon records
 * using a multi-signal approach:
 * 1. Date match (primary): same day (typically Sunday)
 * 2. Duration filter: ignore videos < 30 minutes (non-sermon content)
 *
 * Edge cases handled:
 * - No match: logged, skipped (admin can manually associate)
 * - Multiple sermons on same date: match to closest by title similarity
 * - One campus only: stores single video, UI adapts
 */

import type { Payload } from 'payload'
import { type YouTubeVideo, type CampusKey, parseDuration } from '@/lib/youtube-api'

const MIN_DURATION_SECONDS = 30 * 60 // 30 minutes

export interface MatchResult {
  sermonId: string
  campus: CampusKey
  campusPayloadId: string
  video: YouTubeVideo
}

export interface MatchSummary {
  matched: MatchResult[]
  unmatched: YouTubeVideo[]
  filtered: YouTubeVideo[]
}

/**
 * Normalize a date to YYYY-MM-DD for comparison.
 */
function toDateString(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toISOString().split('T')[0]
}

/**
 * Simple word overlap score for title comparison.
 * Returns 0-1 where 1 is perfect overlap.
 */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/))
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/))

  // Remove common filler words
  const filler = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'is', 'and', 'or', 'ev', 'church', 'live', 'stream', 'service', 'sunday'])
  for (const word of filler) {
    wordsA.delete(word)
    wordsB.delete(word)
  }

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let overlap = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++
  }

  return overlap / Math.max(wordsA.size, wordsB.size)
}

/**
 * Match YouTube videos to sermon records.
 *
 * For each campus's videos:
 * 1. Filter out short videos (< 30 min)
 * 2. Find sermons published on the same date
 * 3. If multiple sermons match by date, pick the best title match
 * 4. Skip videos that already have a matching record on the sermon
 */
export async function matchVideosToSermons(
  payload: Payload,
  videosByCampus: Record<CampusKey, YouTubeVideo[]>,
): Promise<MatchSummary> {
  const matched: MatchResult[] = []
  const unmatched: YouTubeVideo[] = []
  const filtered: YouTubeVideo[] = []

  // Build a campus name -> Payload ID lookup
  const campusRecords = await payload.find({
    collection: 'campuses',
    limit: 100,
    depth: 0,
    select: { name: true },
  })

  const campusIdMap: Record<string, string> = {}
  for (const campus of campusRecords.docs) {
    const name = (campus.name as string).toLowerCase()
    if (name.includes('central')) campusIdMap.central = String(campus.id)
    if (name.includes('north')) campusIdMap.north = String(campus.id)
  }

  // Fetch recent sermons (last 30 days) for matching
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const sermons = await payload.find({
    collection: 'sermons',
    where: {
      publishedAt: { greater_than: thirtyDaysAgo.toISOString() },
      isPublished: { equals: true },
    },
    limit: 100,
    depth: 0,
    select: {
      title: true,
      publishedAt: true,
      videos: true,
      pipelineStatus: true,
    },
  })

  // Index sermons by date for fast lookup
  const sermonsByDate = new Map<string, Array<typeof sermons.docs[0]>>()
  for (const sermon of sermons.docs) {
    if (!sermon.publishedAt) continue
    const dateKey = toDateString(sermon.publishedAt as string)
    const existing = sermonsByDate.get(dateKey) || []
    existing.push(sermon)
    sermonsByDate.set(dateKey, existing)
  }

  for (const [campus, videos] of Object.entries(videosByCampus) as Array<[CampusKey, YouTubeVideo[]]>) {
    const campusPayloadId = campusIdMap[campus]
    if (!campusPayloadId) {
      payload.logger.warn(`[YouTubeMatcher] No campus record found for "${campus}"`)
      continue
    }

    for (const video of videos) {
      // Duration filter
      const durationSeconds = parseDuration(video.duration)
      if (durationSeconds < MIN_DURATION_SECONDS) {
        filtered.push(video)
        continue
      }

      // Date match
      const videoDate = toDateString(video.publishedAt)
      const candidates = sermonsByDate.get(videoDate)

      if (!candidates || candidates.length === 0) {
        unmatched.push(video)
        continue
      }

      // Pick best candidate by title similarity
      let bestSermon = candidates[0]
      let bestScore = -1

      for (const sermon of candidates) {
        const score = titleSimilarity(video.title, sermon.title as string)
        if (score > bestScore) {
          bestScore = score
          bestSermon = sermon
        }
      }

      // Check if this campus video is already stored on this sermon
      const existingVideos = bestSermon.videos ?? []
      const alreadyMatched = existingVideos.some(
        (v) => v.youtubeVideoId === video.videoId,
      )

      if (alreadyMatched) continue

      matched.push({
        sermonId: String(bestSermon.id),
        campus,
        campusPayloadId,
        video,
      })
    }
  }

  return { matched, unmatched, filtered }
}
