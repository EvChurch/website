import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { SermonArticle } from '@/payload-types'
import type { Payload, TaskConfig } from 'payload'
import { relationID } from '@/lib/sermon-management/drive'
import { copyWorkFile } from '@/lib/sermon-management/storage'
import { ffmpeg, validateCut } from '@/lib/sermon-management/audio'
import { rockFetch, RockAPIError } from '@/lib/rock-api'
import { withProduction } from '@/lib/sermon-management/workflow'
import { withArticle } from '@/lib/sermon-articles/workflow'
import { krispRequest, krispTranscript, validateKrispUploadURL, type KrispImport, type KrispStatus } from '@/lib/sermon-articles/krisp'
import { reviewToken } from '@/lib/sermon-articles/security'
import { createResendSiteFeedbackTransport } from '@/lib/site-feedback/notification'

export async function createArticleForProduction(payload: Payload, productionId: number) {
  return withProduction(payload, productionId, undefined, async (production, req) => {
    if (production.status !== 'published' || !production.source) return
    const sermonId = relationID(production.sermon)!
    const sermon = await payload.findByID({ collection: 'sermons', id: sermonId, depth: 0, req })
    if (sermon.blogPost) return
    const existing = await payload.find({ collection: 'sermon-articles', req, depth: 0, limit: 1, where: { sermon: { equals: sermonId } } })
    if (existing.docs.length) return
    const metadata = production.metadata as { audioSpeaker?: number; title?: string; passageReference?: string; series?: number[] } | null
    if (!metadata?.audioSpeaker) return
    const speaker = await payload.findByID({ collection: 'speakers', id: metadata.audioSpeaker, req, depth: 0 })
    if (!speaker.rockPersonId) return
    let person: { Email?: string | null }
    try {
      person = await rockFetch({ endpoint: `People/${speaker.rockPersonId}`, params: { $select: 'Email' } })
    } catch (error) {
      if (error instanceof RockAPIError && error.status === 404) return
      throw error
    }
    const email = person.Email?.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    await payload.create({ collection: 'sermon-articles', req, data: {
      sermon: sermonId, production: production.id, title: metadata.title || sermon.title,
      author: speaker.name, reviewEmail: email, rockPersonId: speaker.rockPersonId,
      series: metadata.series?.[0], passageReference: metadata.passageReference,
      status: 'transcribing', revision: randomUUID(),
    } })
  })
}

async function prepareTranscript(payload: Payload, id: number) {
  const token = randomUUID()
  const article = await withArticle(payload, id, async (current, req) => {
    if (current.status !== 'transcribing' || (current.leaseExpiresAt && Date.parse(current.leaseExpiresAt) > Date.now())) return null
    return payload.update({ collection: 'sermon-articles', id, req, data: { leaseToken: token, leaseExpiresAt: new Date(Date.now() + 25 * 60_000).toISOString() } })
  })
  if (!article) return
  const update = (data: Partial<SermonArticle>) => withArticle(payload, id, async (current, req) => {
    if (current.status !== 'transcribing' || current.leaseToken !== token) throw new Error('Transcription claim expired.')
    return payload.update({ collection: 'sermon-articles', id, req, data })
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
      const response = await fetch(validateKrispUploadURL(uploadUrl), { method: 'PUT', body: bytes, signal: AbortSignal.timeout(120_000), redirect: 'error' })
      if (!response.ok) throw new Error('Krisp upload failed.')
      await update({ krispUploaded: true })
    }
    if (status.status === 'ready' && status.meeting_id) {
      const transcript = await krispTranscript(status.meeting_id)
      await update({ status: 'drafting', transcript, krispUploadUrl: null, error: null, leaseToken: null, leaseExpiresAt: null, attempts: 0 })
      return
    }
    await update({ leaseToken: null, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), error: null })
  } catch {
    await update({ error: 'Transcription is waiting for Krisp or its configuration. Check the API key and recording.', leaseToken: null, leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function sendReview(payload: Payload, id: number) {
  await withArticle(payload, id, async (article, req) => {
    if (article.status !== 'review' || article.reviewSentAt || (article.attempts || 0) >= 6) return
    if (!article.reviewReadyAt || Date.now() - Date.parse(article.reviewReadyAt) > 23 * 60 * 60_000) {
      await payload.update({ collection: 'sermon-articles', id, req, data: { attempts: 6, error: 'Review email delivery needs checking before retrying outside the provider idempotency window.' } })
      return
    }
    const origin = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!origin) throw new Error('Configure the website origin before sending reviews.')
    const url = new URL('/sermon-review', origin)
    url.hash = reviewToken(id, payload.secret)
    try {
      await createResendSiteFeedbackTransport().send({
        to: article.reviewEmail, subject: `Review your article: ${article.title}`,
        text: `Your article “${article.title}” is ready to review. Use this private link to listen, edit and resolve any questions. Approving publishes it immediately.\n\n${url}\n\nKeep this link private; it grants editing and publishing access.`,
        html: '',
      }, `sermon-article-review-${article.id}`)
      await payload.update({ collection: 'sermon-articles', id, req, data: { reviewSentAt: new Date().toISOString(), attempts: (article.attempts || 0) + 1, error: null } })
    } catch {
      await payload.update({ collection: 'sermon-articles', id, req, data: { attempts: (article.attempts || 0) + 1, error: 'Review email could not be delivered. Check the email provider configuration.' } })
    }
  })
}

export const sermonArticleTasks: TaskConfig[] = [
  {
    slug: 'prepareSermonArticle', retries: 3,
    inputSchema: [{ name: 'productionId', type: 'number', required: true }], outputSchema: [],
    handler: async ({ input, req }) => { await createArticleForProduction(req.payload, (input as { productionId: number }).productionId); return { output: {} } },
  },
  {
    slug: 'advanceSermonArticles', retries: 1,
    inputSchema: [], outputSchema: [], schedule: [{ cron: '*/5 * * * *', queue: 'sermon-articles' }],
    handler: async ({ req }) => {
      const articles = await req.payload.find({ collection: 'sermon-articles', depth: 0, limit: 20, sort: 'updatedAt', where: { or: [{ status: { equals: 'transcribing' } }, { and: [{ status: { equals: 'review' } }, { reviewSentAt: { exists: false } }, { attempts: { less_than: 6 } }] }] } })
      for (const article of articles.docs) {
        if (article.status === 'transcribing') await prepareTranscript(req.payload, article.id)
        else await sendReview(req.payload, article.id)
      }
      return { output: {} }
    },
  },
]
