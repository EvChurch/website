/**
 * Transcript sync runner.
 *
 * Orchestrates Phase 2 of the sermon pipeline:
 * 1. Find sermons with status "video-matched" (have YouTube videos but no transcript)
 * 2. Fetch YouTube auto-generated captions
 * 3. Run boundary detection to identify sermon start/end
 * 4. Update sermon records with transcript and boundaries
 */

import type { Payload } from 'payload'
import { revalidateTag } from 'next/cache'
import { fetchYouTubeTranscript } from '@/pipeline/youtube-transcript'
import { detectBoundaries } from '@/pipeline/boundary-detector'
import { CACHE_TAGS } from '@/lib/cache-tags'

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

      // Use the first video's ID for transcript (typically the Central campus livestream)
      const videoId = videos[0].youtubeVideoId
      if (!videoId) {
        result.skipped++
        continue
      }

      payload.logger.info(
        `[TranscriptSync] Processing "${sermon.title}" (video: ${videoId})`,
      )

      // Step 1: Fetch YouTube transcript
      const transcript = await fetchYouTubeTranscript(videoId)

      if (transcript.error || !transcript.fullText) {
        result.errors++
        await payload.update({
          collection: 'sermons',
          id: sermon.id,
          data: {
            pipelineStatus: 'failed',
            pipelineError: transcript.error ?? 'Empty transcript',
          },
        })
        payload.logger.error(
          `[TranscriptSync] Transcript fetch failed for "${sermon.title}": ${transcript.error}`,
        )
        continue
      }

      result.transcribed++

      payload.logger.info(
        `[TranscriptSync] Got transcript for "${sermon.title}" (${transcript.segments.length} segments)`,
      )

      // Step 2: Run boundary detection
      const boundaries = await detectBoundaries(transcript.fullText)

      const existingInputTokens = sermon.aiInputTokens ?? 0
      const existingOutputTokens = sermon.aiOutputTokens ?? 0

      if (boundaries.error || !boundaries.boundaries) {
        // Transcript succeeded but boundary detection failed.
        // Still save the transcript and advance to "transcribed" status.
        await payload.update({
          collection: 'sermons',
          id: sermon.id,
          data: {
            transcript: transcript.fullText,
            pipelineStatus: 'transcribed',
            pipelineError: boundaries.error
              ? `Boundary detection failed: ${boundaries.error}`
              : null,
            aiInputTokens: existingInputTokens + boundaries.inputTokens,
            aiOutputTokens: existingOutputTokens + boundaries.outputTokens,
          },
        })
        payload.logger.warn(
          `[TranscriptSync] Boundary detection failed for "${sermon.title}": ${boundaries.error}`,
        )
        continue
      }

      // Step 3: Save transcript + boundaries
      result.boundariesSet++

      await payload.update({
        collection: 'sermons',
        id: sermon.id,
        data: {
          transcript: transcript.fullText,
          sermonStartSeconds: boundaries.boundaries.sermonStartSeconds,
          sermonEndSeconds: boundaries.boundaries.sermonEndSeconds,
          boundariesAutoDetected: true,
          pipelineStatus: 'boundaries-set',
          pipelineError: null,
          aiInputTokens: existingInputTokens + boundaries.inputTokens,
          aiOutputTokens: existingOutputTokens + boundaries.outputTokens,
        },
      })

      payload.logger.info(
        `[TranscriptSync] Boundaries set for "${sermon.title}": ` +
          `${boundaries.boundaries.sermonStartSeconds}s - ${boundaries.boundaries.sermonEndSeconds}s ` +
          `(${boundaries.boundaries.confidence} confidence: ${boundaries.boundaries.reasoning})`,
      )
    } catch (error) {
      result.errors++
      payload.logger.error(
        `[TranscriptSync] Failed to process sermon ${sermon.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Revalidate cache if any updates were made
  if (result.transcribed > 0 || result.boundariesSet > 0) {
    revalidateTag(CACHE_TAGS.sermons, 'default')
    revalidateTag(CACHE_TAGS.sermonPipeline, 'default')
  }

  payload.logger.info(
    `[TranscriptSync] Complete: processed=${result.processed} transcribed=${result.transcribed} ` +
      `boundaries=${result.boundariesSet} skipped=${result.skipped} errors=${result.errors}`,
  )

  return result
}
