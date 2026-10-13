import type { TranscriptSegment } from '@/lib/sermon-articles/krisp'
export function readTranscriptSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return []
  return value.filter((segment): segment is TranscriptSegment => segment && typeof segment === 'object' &&
    typeof segment.text === 'string' && typeof segment.start === 'number' && Number.isFinite(segment.start) && segment.start >= 0 &&
    typeof segment.end === 'number' && Number.isFinite(segment.end) && segment.end >= segment.start)
}
