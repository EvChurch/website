const BASE = 'https://meeting-api.krisp.ai/v1'
export interface KrispImport { import_id: string; url: string; expires_at: string }
export interface KrispStatus { status: 'uploading' | 'processing' | 'ready' | 'failed'; meeting_id?: string }
export interface TranscriptSegment { text: string; start: number; end: number }
interface KrispMeeting { transcript?: { segments?: Array<{ text: string; start: number; end: number }> } }

export async function krispRequest<T>(endpoint: string, body?: object): Promise<T> {
  const key = process.env.KRISP_API_KEY
  if (!key) throw new Error('Krisp API key is not configured.')
  const response = await fetch(`${BASE}/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Krisp request failed (${response.status}).`)
  return response.json() as Promise<T>
}
export async function krispSegments(meetingId: string): Promise<TranscriptSegment[]> {
  const meeting = await krispRequest<KrispMeeting>(`meetings/${encodeURIComponent(meetingId)}?fields=transcript`)
  const segments = meeting.transcript?.segments
  if (!segments?.length || segments.some((segment) => typeof segment.text !== 'string' || !Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end < segment.start))
    throw new Error('Krisp transcript is not ready.')
  return segments.map(({ text, start, end }) => ({ text, start, end }))
}
export function validateKrispUploadURL(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.amazonaws.com') || url.username || url.password || url.port)
    throw new Error('Krisp returned an invalid upload destination.')
  return url.toString()
}

export async function krispTranscript(meetingId: string) {
  return (await krispSegments(meetingId)).map(segment => `[${segment.start.toFixed(1)}s] ${segment.text}`).join('\n')
}
