/**
 * Transcript sync runner.
 *
 * Orchestrates Phase 2 of the sermon pipeline:
 * 1. Find sermons with status "video-matched" (have YouTube videos but no transcript)
 * 2. For each campus video, fetch YouTube auto-generated captions
 * 3. Run boundary detection to identify sermon start/end per video
 * 4. Update sermon records with per-video transcript and boundaries
 */

import type { Payload } from 'payload'
import { fetchYouTubeTranscript } from '@/pipeline/youtube-transcript'
import { detectBoundaries } from '@/pipeline/boundary-detector'

export interface TranscriptSyncResult {
  processed: number
  transcribed: number
  boundariesSet: number
  skipped: number
  errors: number
}

export async function runTranscriptSync(
  payload: Payload,
): Promise<TranscriptSyncResult> {
  payload.logger.info('[TranscriptSync] Starting transcript sync')

  const result: TranscriptSyncResult = {
    processed: 0,
    transcribed: 0,
    boundariesSet: 0,
    skipped: 0,
    errors: 0,
  }

  // Find sermons that have been video-matched but not yet transcribed
  const sermons = await payload.find({
    collection: 'sermons',
    where: {
      pipelineStatus: { equals: 'video-matched' },
    },
    limit: 10,
    depth: 0,
    select: {
      title: true,
      videos: true,
      pipelineStatus: true,
      aiInputTokens: true,
      aiOutputTokens: true,
    },
  })

  if (sermons.docs.length === 0) {
    payload.logger.info('[TranscriptSync] No video-matched sermons to process')
    return result
  }

  payload.logger.info(
    `[TranscriptSync] Found ${sermons.docs.length} sermons to process`,
  )

  for (const sermon of sermons.docs) {
    result.processed++

    try {
      const videos = sermon.videos ?? []
      if (videos.length === 0) {
        result.skipped++
        continue
      }

      payload.logger.info(
        `[TranscriptSync] Processing "${sermon.title}" (${videos.length} video${videos.length > 1 ? 's' : ''})`,
      )

      let totalInputTokens = sermon.aiInputTokens ?? 0
      let totalOutputTokens = sermon.aiOutputTokens ?? 0
      let allBoundariesSet = true
      let anyTranscribed = false
      let anyFailed = false
      const updatedVideos = [...videos]

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i]
        const videoId = video.youtubeVideoId
        if (!videoId) continue

        // Skip if this video already has boundaries
        if (video.sermonStartSeconds != null && video.sermonEndSeconds != null) {
          continue
        }

        payload.logger.info(
          `[TranscriptSync] Fetching transcript for video ${videoId} (${i + 1}/${videos.length})`,
        )

        // Fetch transcript
        const transcript = await fetchYouTubeTranscript(videoId)

        if (transcript.error || !transcript.fullText) {
          payload.logger.error(
            `[TranscriptSync] Transcript failed for video ${videoId}: ${transcript.error}`,
          )
          allBoundariesSet = false
          anyFailed = true
          continue
        }

        anyTranscribed = true

        payload.logger.info(
          `[TranscriptSync] Got transcript for video ${videoId} (${transcript.segmentCount} segments)`,
        )

        // Run boundary detection
        const boundaries = await detectBoundaries(transcript.fullText)
        totalInputTokens += boundaries.inputTokens
        totalOutputTokens += boundaries.outputTokens

        if (boundaries.error || !boundaries.boundaries) {
          payload.logger.warn(
            `[TranscriptSync] Boundary detection failed for video ${videoId}: ${boundaries.error}`,
          )
          // Still save the transcript on the video
          updatedVideos[i] = {
            ...video,
            transcript: transcript.fullText,
          }
          allBoundariesSet = false
          continue
        }

        // Save transcript + boundaries on the video
        updatedVideos[i] = {
          ...video,
          transcript: transcript.fullText,
          sermonStartSeconds: boundaries.boundaries.sermonStartSeconds,
          sermonEndSeconds: boundaries.boundaries.sermonEndSeconds,
        }

        payload.logger.info(
          `[TranscriptSync] Boundaries set for video ${videoId}: ` +
            `${boundaries.boundaries.sermonStartSeconds}s - ${boundaries.boundaries.sermonEndSeconds}s ` +
            `(${boundaries.boundaries.confidence} confidence)`,
        )
      }

      // Determine pipeline status
      type PipelineStatus = 'boundaries-set' | 'transcribed' | 'failed'
      let pipelineStatus: PipelineStatus
      if (allBoundariesSet && anyTranscribed) {
        pipelineStatus = 'boundaries-set'
        result.boundariesSet++
      } else if (anyTranscribed) {
        pipelineStatus = 'transcribed'
        result.transcribed++
      } else if (anyFailed) {
        pipelineStatus = 'failed'
        result.errors++
      } else {
        result.skipped++
        continue
      }

      await payload.update({
        collection: 'sermons',
        id: sermon.id,
        data: {
          videos: updatedVideos,
          boundariesAutoDetected: allBoundariesSet && anyTranscribed,
          pipelineStatus,
          pipelineError: anyFailed && !anyTranscribed
            ? 'Transcript fetch failed for all videos'
            : null,
          aiInputTokens: totalInputTokens,
          aiOutputTokens: totalOutputTokens,
        },
      })
    } catch (error) {
      result.errors++
      payload.logger.error(
        `[TranscriptSync] Failed to process sermon ${sermon.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  payload.logger.info(
    `[TranscriptSync] Complete: processed=${result.processed} transcribed=${result.transcribed} ` +
      `boundaries=${result.boundariesSet} skipped=${result.skipped} errors=${result.errors}`,
  )

  return result
}
