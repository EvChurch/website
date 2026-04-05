/**
 * Sermon boundary detector.
 *
 * Uses Claude Haiku 4.5 to analyze a transcript and identify
 * the start and end timestamps of the sermon segment within
 * a longer livestream recording.
 */

import Anthropic from '@anthropic-ai/sdk'

export interface BoundaryResult {
  sermonStartSeconds: number
  sermonEndSeconds: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface BoundaryDetectionOutput {
  boundaries: BoundaryResult | null
  inputTokens: number
  outputTokens: number
  error: string | null
}

const SYSTEM_PROMPT = `You are analyzing a church service transcript to identify the sermon segment boundaries.

The transcript contains timestamped content from a full livestream that includes worship, announcements, Bible readings, the sermon, and other service elements.

Your task is to identify precisely when the sermon begins and ends.

**Sermon start indicators:**
- The sermon starts when the preacher is first introduced or begins speaking, including their greeting and introduction (e.g. "My name is...", "Good morning church")
- This includes the preacher's opening prayer before the main teaching
- The start is NOT the service welcome or worship leader's remarks, but the moment the preacher takes the stage

**Sermon end indicators:**
- The sermon ends AFTER the preacher's closing prayer, not before it. The closing prayer is part of the sermon.
- The closing prayer typically ends with "in Jesus' name", "Amen", or both. The end timestamp should be immediately after this.
- To find the correct closing prayer: look for where the teaching/application content ends and the preacher transitions to prayer. This is the FIRST prayer after the main teaching. If you then see worship music/singing start, that confirms you found the right prayer.
- Do NOT scan forward past worship songs to find a later prayer. The sermon is over once the congregation starts singing.

Return a JSON object with exactly these fields:
- sermonStartTimestamp: string (the [HH:MM:SS] timestamp from the transcript, e.g. "00:39:09")
- sermonEndTimestamp: string (the [HH:MM:SS] timestamp from the transcript, e.g. "01:23:20")
- confidence: "high" | "medium" | "low"
- reasoning: string (brief explanation of why these boundaries were chosen)

Rules:
- Use the exact [HH:MM:SS] timestamps from the transcript. Do not convert to seconds.
- If you cannot identify clear boundaries, set confidence to "low"
- The sermon is typically 25-45 minutes long
- Do not include worship songs, announcements, or offering segments
- Never use em dashes in your output`

/**
 * Parse an HH:MM:SS or MM:SS timestamp string to total seconds.
 * Returns null if the format is invalid.
 */
function parseTimestamp(timestamp: string): number | null {
  const parts = timestamp.replace(/[\[\]]/g, '').trim().split(':')
  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number)
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const [m, s] = parts.map(Number)
    if (isNaN(m) || isNaN(s)) return null
    return m * 60 + s
  }
  return null
}

/**
 * Detect sermon boundaries from a transcript using Claude Haiku 4.5.
 */
export async function detectBoundaries(
  transcript: string,
): Promise<BoundaryDetectionOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      boundaries: null,
      inputTokens: 0,
      outputTokens: 0,
      error: 'ANTHROPIC_API_KEY environment variable is required',
    }
  }

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this church service transcript and identify the sermon boundaries:\n\n${transcript}`,
        },
      ],
    })

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return {
        boundaries: null,
        inputTokens,
        outputTokens,
        error: 'No text response from Claude',
      }
    }

    // Parse JSON from the response (handle markdown code blocks)
    const jsonText = textBlock.text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(jsonText) as Record<string, unknown>

    // Convert HH:MM:SS timestamps to seconds
    const startSeconds = parseTimestamp(String(parsed.sermonStartTimestamp ?? ''))
    const endSeconds = parseTimestamp(String(parsed.sermonEndTimestamp ?? ''))
    const confidenceRaw = String(parsed.confidence ?? '')
    const confidence =
      confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
        ? confidenceRaw
        : null

    if (
      startSeconds === null ||
      endSeconds === null ||
      startSeconds < 0 ||
      endSeconds <= startSeconds
    ) {
      return {
        boundaries: null,
        inputTokens,
        outputTokens,
        error: `Invalid boundary values: start=${parsed.sermonStartTimestamp}, end=${parsed.sermonEndTimestamp}`,
      }
    }

    if (!confidence) {
      return {
        boundaries: null,
        inputTokens,
        outputTokens,
        error: `Invalid confidence value: ${parsed.confidence}`,
      }
    }

    return {
      boundaries: {
        sermonStartSeconds: startSeconds,
        sermonEndSeconds: endSeconds,
        confidence,
        reasoning: String(parsed.reasoning ?? ''),
      },
      inputTokens,
      outputTokens,
      error: null,
    }
  } catch (error) {
    return {
      boundaries: null,
      inputTokens: 0,
      outputTokens: 0,
      error: `Boundary detection failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
