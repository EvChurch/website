/**
 * YouTube sync runner.
 *
 * Orchestrates fetching videos from campus YouTube channels,
 * matching them to existing sermon records, and updating the
 * Sermons collection with video references.
 */

import type { Payload } from 'payload'
import { revalidateTag } from 'next/cache'
import { fetchAllCampusVideos } from '@/lib/youtube-api'
import { matchVideosToSermons } from '@/pipeline/youtube-matcher'
import { CACHE_TAGS } from '@/lib/cache-tags'

export interface YouTubeSyncResult {
  matched: number
  unmatched: number
  filtered: number
  errors: number
}

export async function runYouTubeSync(
  payload: Payload,
): Promise<YouTubeSyncResult> {
  payload.logger.info('[YouTubeSync] Starting YouTube video sync')

  // Step 1: Fetch recent videos from all campus channels
  const videosByCampus = await fetchAllCampusVideos(10)

  const totalVideos = Object.values(videosByCampus).reduce(
    (sum, videos) => sum + videos.length,
    0,
  )
  payload.logger.info(`[YouTubeSync] Fetched ${totalVideos} videos across campuses`)

  // Step 2: Match videos to sermons
  const { matched, unmatched, filtered } = await matchVideosToSermons(
    payload,
    videosByCampus,
  )

  payload.logger.info(
    `[YouTubeSync] Match results: ${matched.length} matched, ${unmatched.length} unmatched, ${filtered.length} filtered (too short)`,
  )

  // Step 3: Update sermon records with matched videos
  let errors = 0

  for (const match of matched) {
    try {
      // Fetch current sermon to get existing videos array
      const sermon = await payload.findByID({
        collection: 'sermons',
        id: match.sermonId,
        depth: 0,
        select: { videos: true, pipelineStatus: true },
      })

      const existingVideos = (sermon.videos as Array<Record<string, unknown>>) || []

      // Append the new video reference
      const updatedVideos = [
        ...existingVideos,
        {
          campus: match.campusPayloadId,
          youtubeVideoId: match.video.videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${match.video.videoId}`,
          thumbnailUrl: match.video.thumbnailUrl,
        },
      ]

      // Advance pipeline status if it was 'none'
      const currentStatus = sermon.pipelineStatus
      const newStatus = currentStatus === 'none' ? 'video-matched' as const : currentStatus

      await payload.update({
        collection: 'sermons',
        id: match.sermonId,
        data: {
          videos: updatedVideos,
          pipelineStatus: newStatus,
        },
      })

      payload.logger.info(
        `[YouTubeSync] Matched ${match.campus} video "${match.video.title}" to sermon ${match.sermonId}`,
      )
    } catch (error) {
      errors++
      payload.logger.error(
        `[YouTubeSync] Failed to update sermon ${match.sermonId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Log unmatched videos for admin awareness
  for (const video of unmatched) {
    payload.logger.warn(
      `[YouTubeSync] Unmatched video: "${video.title}" (${video.publishedAt})`,
    )
  }

  // Step 4: Revalidate cache if any updates were made
  if (matched.length > 0) {
    revalidateTag(CACHE_TAGS.sermons, 'default')
    revalidateTag(CACHE_TAGS.sermonPipeline, 'default')
  }

  const result: YouTubeSyncResult = {
    matched: matched.length,
    unmatched: unmatched.length,
    filtered: filtered.length,
    errors,
  }

  payload.logger.info(
    `[YouTubeSync] Sync complete: matched=${result.matched} unmatched=${result.unmatched} filtered=${result.filtered} errors=${result.errors}`,
  )
  return result
}
