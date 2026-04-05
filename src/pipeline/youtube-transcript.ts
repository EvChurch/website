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

export interface TranscriptSegment {
  text: string
  offsetSeconds: number
  durationSeconds: number
}

export interface TranscriptResult {
  segments: TranscriptSegment[]
  fullText: string
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
 * Returns timestamped segments and a formatted full text suitable
 * for the boundary detector. The full text includes timestamps
 * every ~30 seconds to give the LLM temporal anchors.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
  lang = 'en',
): Promise<TranscriptResult> {
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId, { lang })

    if (!raw || raw.length === 0) {
      return { segments: [], fullText: '', error: 'No transcript segments returned' }
    }

    // Convert from millisecond offsets to seconds
    const segments: TranscriptSegment[] = raw.map((item) => ({
      text: item.text,
      offsetSeconds: item.offset / 1000,
      durationSeconds: item.duration / 1000,
    }))

    // Build formatted transcript with periodic timestamps.
    // Include a timestamp marker roughly every 30 seconds so the
    // boundary detector can reference specific times.
    const lines: string[] = []
    let lastTimestamp = -30

    for (const seg of segments) {
      if (seg.offsetSeconds - lastTimestamp >= 30) {
        lines.push(`\n[${formatTimestamp(seg.offsetSeconds)}]`)
        lastTimestamp = seg.offsetSeconds
      }
      lines.push(seg.text)
    }

    return {
      segments,
      fullText: lines.join(' ').trim(),
      error: null,
    }
  } catch (error) {
    if (
      error instanceof YoutubeTranscriptDisabledError ||
      error instanceof YoutubeTranscriptNotAvailableError
    ) {
      return {
        segments: [],
        fullText: '',
        error: `Transcript not available for video ${videoId}: ${error.message}`,
      }
    }

    return {
      segments: [],
      fullText: '',
      error: `Failed to fetch transcript for ${videoId}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
