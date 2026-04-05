/**
 * YouTube transcript fetcher.
 *
 * Fetches auto-generated captions from YouTube videos and formats
 * them with timestamps for the sermon boundary detector.
 */

import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
} from 'youtube-transcript'

export interface TranscriptResult {
  fullText: string
  segmentCount: number
  error: string | null
}

/**
 * Format seconds as HH:MM:SS for readable transcript output.
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Fetch the transcript for a YouTube video.
 *
 * Returns a formatted full text with timestamp markers every ~30 seconds
 * suitable for the boundary detector.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
  lang = 'en',
): Promise<TranscriptResult> {
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId, { lang })

    if (!raw || raw.length === 0) {
      return { fullText: '', segmentCount: 0, error: 'No transcript segments returned' }
    }

    // Build formatted transcript with periodic timestamps.
    // Include a timestamp marker roughly every 30 seconds so the
    // boundary detector can reference specific times.
    const lines: string[] = []
    let lastTimestamp = -30

    for (const item of raw) {
      const offsetSeconds = item.offset / 1000
      if (offsetSeconds - lastTimestamp >= 30) {
        lines.push(`\n[${formatTimestamp(offsetSeconds)}]`)
        lastTimestamp = offsetSeconds
      }
      lines.push(item.text)
    }

    return {
      fullText: lines.join(' ').trim(),
      segmentCount: raw.length,
      error: null,
    }
  } catch (error) {
    if (
      error instanceof YoutubeTranscriptDisabledError ||
      error instanceof YoutubeTranscriptNotAvailableError
    ) {
      return {
        fullText: '',
        segmentCount: 0,
        error: `Transcript not available for video ${videoId}: ${error.message}`,
      }
    }

    return {
      fullText: '',
      segmentCount: 0,
      error: `Failed to fetch transcript for ${videoId}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
