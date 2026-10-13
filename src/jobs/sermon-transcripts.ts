import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Payload, TaskConfig } from 'payload'
import type { SermonTranscript } from '@/payload-types'
import { relationID } from '@/lib/sermon-management/drive'
import { copyWorkFile } from '@/lib/sermon-management/storage'
import { ffmpeg, validateCut } from '@/lib/sermon-management/audio'
import { krispRequest, krispSegments, validateKrispUploadURL, type KrispImport, type KrispStatus } from '@/lib/sermon-articles/krisp'
import { withTranscript, isCurrentTranscript } from '@/lib/sermon-transcripts/workflow'

export async function prepareSermonTranscript(payload: Payload, id: number) {
  const token = randomUUID()
  const article = await withTranscript(payload, id, async (current, req) => {
    if (!await isCurrentTranscript(payload, current, req)) return null
    if (current.status !== 'transcribing' || (current.leaseExpiresAt && Date.parse(current.leaseExpiresAt) > Date.now())) return null
    return payload.update({ collection: 'sermon-transcripts', id, req, data: { leaseToken: token, leaseExpiresAt: new Date(Date.now() + 25 * 60_000).toISOString() } })
  })
  if (!article) return
  const update = (data: Partial<SermonTranscript>) => withTranscript(payload, id, async (current, req) => {
    if (current.status !== 'transcribing' || current.leaseToken !== token) throw new Error('Transcription claim expired.')
    return payload.update({ collection: 'sermon-transcripts', id, req, data })
  })
  const directory = await mkdtemp(path.join(tmpdir(), 'article-audio-'))
  try {
    if (!process.env.KRISP_API_KEY) throw new Error('Configure KRISP_API_KEY to transcribe sermons.')
    let audioId = relationID(article.audio)
    const audioPath = path.join(directory, 'sermon.mp3')
    if (!audioId) {
      const production = await payload.findByID({ collection: 'sermon-productions', id: relationID(article.production)!, depth: 0 })
      validateCut(production.start!, production.end!, production.sourceDuration!)
      await copyWorkFile(payload, relationID(production.source)!, path.join(directory, 'source'))
      await ffmpeg(['-protocol_whitelist', 'file,pipe', '-format_whitelist', 'aac,aiff,flac,mp3,mov,ogg,wav', '-i', path.join(directory, 'source'), '-vn', '-af', `atrim=start=${production.start}:end=${production.end},asetpts=PTS-STARTPTS`, '-ac', '1', '-ar', '44100', '-b:a', '96k', audioPath])
      const audio = await payload.create({ collection: 'sermon-work-files', filePath: audioPath, data: {} })
      audioId = audio.id
      await update({ audio: audioId })
    } else await copyWorkFile(payload, audioId, audioPath)
    let importId = article.krispImportId
    let uploadUrl = article.krispUploadUrl
    let expires = article.krispUploadExpiresAt
    if (!importId) {
      // A timed-out import POST has an unknown outcome; stop for inspection instead of duplicating it.
      if (article.krispImportStartedAt) {
        await update({ status: 'failed', error: 'Krisp import was interrupted before its ID was saved. Inspect Krisp before retrying.' })
        return
      }
      await update({ krispImportStartedAt: new Date().toISOString(), error: 'Starting Krisp import.' })
      let result: KrispImport
      try {
        result = await krispRequest<KrispImport>('import', { title: article.title, language: 'en' })
      } catch {
        await update({ status: 'failed', error: 'Krisp import could not be confirmed. Check Krisp before retrying to avoid a duplicate recording.' })
        return
      }
      if (!result.import_id || !result.expires_at) throw new Error('Incomplete Krisp import response.')
      importId = result.import_id
      uploadUrl = validateKrispUploadURL(result.url)
      expires = result.expires_at
      await update({ krispImportId: importId, krispUploadUrl: uploadUrl, krispUploadExpiresAt: expires, error: null })
    }
    const status = await krispRequest<KrispStatus>(`import/${encodeURIComponent(importId)}/status`)
    if (status.status === 'failed') {
      await update({ status: 'failed', error: 'Krisp could not transcribe this recording. Inspect the import in Krisp.' })
      return
    }
    if (status.status === 'uploading' && !article.krispUploaded) {
      if (!uploadUrl || !expires || Date.parse(expires) <= Date.now()) {
        await update({ status: 'failed', error: 'The Krisp upload expired. Inspect the import in Krisp before retrying.' })
        return
      }
      const bytes = await readFile(audioPath)
      const response = await fetch(validateKrispUploadURL(uploadUrl), { method: 'PUT', headers: { 'Content-Type': 'audio/mpeg' }, body: bytes, signal: AbortSignal.timeout(120_000), redirect: 'error' })
      if (!response.ok) throw new Error('Krisp upload failed.')
      await update({ krispUploaded: true })
    }
    if (status.status === 'ready' && status.meeting_id) {
      const segments = await krispSegments(status.meeting_id)
      const transcript = segments.map(segment => `[${segment.start.toFixed(1)}s] ${segment.text}`).join('\n')
      // Offset timestamps by the intro used in this exact render, never today's defaults.
      const production = await payload.findByID({ collection: 'sermon-productions', id: relationID(article.production)!, depth: 0 })
      let offset = 0
      if (production.intro) {
        await copyWorkFile(payload, relationID(production.intro)!, path.join(directory, 'intro'))
        const { stdout } = await ffmpeg(['-i', path.join(directory, 'intro'), '-progress', 'pipe:1', '-f', 'null', '-'])
        offset = Number([...stdout.matchAll(/out_time_us=(\d+)/g)].at(-1)?.[1]) / 1_000_000
        if (!Number.isFinite(offset) || offset < 0) throw new Error('Unable to measure intro duration.')
      }
      await withTranscript(payload, id, async (current, req) => {
        if (current.status !== 'transcribing' || current.leaseToken !== token) return
        const sermon = await isCurrentTranscript(payload, current, req)
        if (!sermon) return
        const timed = segments.map(segment => ({ ...segment, start: segment.start + offset, end: segment.end + offset }))
        await payload.update({ collection: 'sermons', id: sermon.id, req, data: { audioTranscript: timed } })
        await payload.update({ collection: 'sermon-transcripts', id, req, data: { status: 'tagging', transcript, segments: timed, audioOffset: offset, krispUploadUrl: null, error: null, leaseToken: null, leaseExpiresAt: null } })
        await payload.jobs.queue({ task: 'prepareSermonArticle', queue: 'sermon-articles', input: { productionId: production.id }, req })
      })
      return
    }
    await update({ leaseToken: null, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), error: null })
  } catch {
    await update({ error: 'Transcription is waiting for Krisp or its configuration. Check the API key and recording.', leaseToken: null, leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}


export const sermonTranscriptTasks: TaskConfig[] = [{
  slug: 'advanceSermonTranscripts', retries: 1, inputSchema: [], outputSchema: [],
  schedule: [{ cron: '*/5 * * * *', queue: 'sermon-articles' }],
  handler: async ({ req }) => {
    const jobs = await req.payload.find({ collection: 'sermon-transcripts', depth: 0, limit: 20, sort: 'updatedAt', where: { status: { equals: 'transcribing' } } })
    for (const job of jobs.docs) await prepareSermonTranscript(req.payload, job.id)
    return { output: {} }
  },
}]
