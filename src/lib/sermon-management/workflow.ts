import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sql } from '@payloadcms/db-postgres'
import {
  APIError,
  createLocalReq,
  type Payload,
  type PayloadRequest,
} from 'payload'
import type { Sermon, SermonProduction, User } from '@/payload-types'
import { relationID, getRecording } from './drive'
import { validateCut } from './audio'
import { calendarDefaults, recordingDate } from './calendar'
import { copyWorkFile } from './storage'

export interface SermonMetadata {
  title: string
  publishedAt: string
  audioSpeaker?: number
  audioCampus?: number
  passageReference: string
  series: number[]
  topics: number[]
  scriptures: number[]
}

export function readMetadata(value: unknown): SermonMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new APIError('Sermon details are required.', 400)
  const row = value as Record<string, unknown>
  const text = (key: string) =>
    typeof row[key] === 'string' ? row[key].trim().slice(0, 500) : ''
  const id = (key: string) =>
    typeof row[key] === 'number' &&
    Number.isSafeInteger(row[key]) &&
    row[key] > 0
      ? row[key]
      : undefined
  const ids = (key: string) =>
    Array.isArray(row[key])
      ? [
          ...new Set(
            row[key].filter(
              (n): n is number =>
                typeof n === 'number' && Number.isSafeInteger(n) && n > 0,
            ),
          ),
        ].slice(0, 50)
      : []
  const publishedAt = text('publishedAt')
  if (publishedAt && !Number.isFinite(Date.parse(publishedAt)))
    throw new APIError('Choose a valid sermon date.', 400)
  return {
    title: text('title'),
    publishedAt,
    audioSpeaker: id('audioSpeaker'),
    audioCampus: id('audioCampus'),
    passageReference: text('passageReference'),
    series: ids('series'),
    topics: ids('topics'),
    scriptures: ids('scriptures'),
  }
}

export function metadataFromSermon(sermon: Sermon): SermonMetadata {
  return {
    title: sermon.title,
    publishedAt: sermon.publishedAt || '',
    audioSpeaker: relationID(sermon.audioSpeaker),
    audioCampus: relationID(sermon.audioCampus),
    passageReference: sermon.passageReference || '',
    series: (sermon.series || []).map((item) => relationID(item)!),
    topics: (sermon.topics || []).map((item) => relationID(item)!),
    scriptures: (sermon.scriptures || []).map((item) => relationID(item)!),
  }
}

/** Ignore pipeline/search bookkeeping when detecting conflicting editorial changes. */
function sermonRevision(sermon: Sermon) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...metadataFromSermon(sermon),
        audio: relationID(sermon.audio),
        duration: sermon.duration,
        isPublished: sermon.isPublished,
        slug: sermon.slug,
      }),
    )
    .digest('hex')
}

async function checkPublishedRevision(
  payload: Payload,
  production: SermonProduction,
  req: PayloadRequest,
) {
  const session = payload.db.sessions?.[await req.transactionID!] as {
    db: { execute(query: ReturnType<typeof sql>): Promise<unknown> }
  }
  const sermonId = relationID(production.sermon)!
  await session.db.execute(
    sql`SELECT id FROM sermons WHERE id = ${sermonId} FOR UPDATE`,
  )
  const current = await payload.findByID({
    collection: 'sermons',
    id: sermonId,
    depth: 0,
    req,
  })
  if (sermonRevision(current) !== production.baseSermonRevision) {
    throw new APIError(
      'The published sermon has changed since this draft was opened. Open a fresh revision from the archive.',
      409,
    )
  }
  return current
}

/** All workflow changes serialize on the production row; queued jobs carry its revision token. */
export async function withProduction<T>(
  payload: Payload,
  id: number,
  user: User | undefined,
  fn: (production: SermonProduction, req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID == null)
    throw new Error('Sermon management requires database transactions.')
  const req = await createLocalReq(
    { user, req: { transactionID, context: { skipCacheInvalidation: true } } },
    payload,
  )
  try {
    const session = payload.db.sessions?.[transactionID] as
      | { db: { execute(query: ReturnType<typeof sql>): Promise<unknown> } }
      | undefined
    if (!session) throw new Error('Database transaction is unavailable.')
    await session.db.execute(
      sql`SELECT id FROM sermon_productions WHERE id = ${id} FOR UPDATE`,
    )
    const production = await payload.findByID({
      collection: 'sermon-productions',
      id,
      depth: 0,
      req,
    })
    const result = await fn(production, req)
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

export async function beginProduction(
  payload: Payload,
  sermonId: number | undefined,
  fileId?: string,
  draftMetadata?: unknown,
  previousProductionId?: number,
  previousToken?: unknown,
): Promise<number> {
  if (!previousProductionId)
    return createProduction(payload, sermonId, fileId, draftMetadata)
  if (!fileId) throw new APIError('Choose a replacement recording.', 400)
  return withProduction(
    payload,
    previousProductionId,
    undefined,
    async (previous, req) => {
      if (
        previous.jobToken !== previousToken ||
        ['published', 'discarded'].includes(previous.status) ||
        relationID(previous.sermon) !== sermonId
      ) {
        throw new APIError(
          'This draft changed in another session. Reload before replacing the recording.',
          409,
        )
      }
      await checkPublishedRevision(payload, previous, req)
      const id = await createProduction(
        payload,
        sermonId,
        fileId,
        draftMetadata,
        req,
      )
      await payload.update({
        collection: 'sermon-productions',
        id: previous.id,
        req,
        data: { status: 'discarded', jobToken: randomUUID() },
      })
      return id
    },
  )
}

async function createProduction(
  payload: Payload,
  sermonId: number | undefined,
  fileId?: string,
  draftMetadata?: unknown,
  req?: PayloadRequest,
) {
  const settings = await payload.findGlobal({
    slug: 'sermon-settings',
    req,
    depth: 0,
  })
  const recording = fileId ? await getRecording(settings, fileId) : undefined
  const sermon = sermonId
    ? await payload.findByID({
        collection: 'sermons',
        id: sermonId,
        depth: 0,
        req,
      })
    : await payload.create({
        collection: 'sermons',
        req,
        data: {
          title:
            recording?.file.name.replace(/\.[^.]+$/, '') || 'Untitled sermon',
          slug: '',
          isPublished: false,
        },
      })
  if (sermonId && !fileId) {
    const existing = await payload.find({
      collection: 'sermon-productions',
      req,
      depth: 0,
      limit: 1,
      sort: '-updatedAt',
      where: {
        and: [
          { sermon: { equals: sermonId } },
          { baseSermonRevision: { equals: sermonRevision(sermon) } },
          { status: { not_in: ['published', 'discarded'] } },
        ],
      },
    })
    if (existing.docs[0]) return existing.docs[0].id
  }
  const metadata = draftMetadata
    ? readMetadata(draftMetadata)
    : metadataFromSermon(sermon)
  if (recording) metadata.audioCampus = recording.campus
  const defaults = recording && !sermon.isPublished
    ? await calendarDefaults(payload, settings, recording.file.name, recording.campus, req)
    : undefined
  const initialMetadata = defaults
    ? fillMissingCalendarMetadata(metadata, defaults.metadata, sermon.title)
    : metadata
  const production = await payload.create({
    collection: 'sermon-productions',
    req,
    data: {
      sermon: sermon.id,
      baseSermonRevision: sermonRevision(sermon),
      sourceName: recording?.file.name || (sermon.audio ? 'Existing published audio' : 'Choose a recording'),
      driveFileId: recording?.file.id,
      driveModifiedTime: recording?.file.modifiedTime,
      campus: recording?.campus || metadata.audioCampus,
      metadata: { ...initialMetadata },
      calendarNotice: defaults?.notice,
      status: recording ? 'importing' : 'ready',
      jobToken: randomUUID(),
      publishedAudio: relationID(sermon.audio),
      outputDuration: sermon.duration,
    },
  })
  if (recording) await queueProduction(payload, production, req)
  return production.id
}

/** Reattaching audio fills gaps without replacing a manager's authored details. */
export function fillMissingCalendarMetadata(
  metadata: SermonMetadata,
  defaults: Partial<SermonMetadata>,
  originalTitle: string,
): SermonMetadata {
  return {
    ...metadata,
    title:
      !metadata.title.trim() ||
      (metadata.title === originalTitle &&
        (recordingDate(originalTitle) || originalTitle === 'Untitled sermon'))
        ? defaults.title || metadata.title
        : metadata.title,
    publishedAt: metadata.publishedAt || defaults.publishedAt || '',
    audioSpeaker: metadata.audioSpeaker || defaults.audioSpeaker,
    audioCampus: metadata.audioCampus || defaults.audioCampus,
    passageReference: metadata.passageReference || defaults.passageReference || '',
    series: metadata.series.length ? metadata.series : defaults.series || [],
    scriptures: metadata.scriptures.length ? metadata.scriptures : defaults.scriptures || [],
  }
}

async function queueProduction(
  payload: Payload,
  production: SermonProduction,
  req?: PayloadRequest,
) {
  try {
    await payload.jobs.queue({
      task: 'prepareSermonAudio',
      queue: 'sermon-audio',
      input: { productionId: production.id, token: production.jobToken },
      req,
    })
  } catch (error) {
    if (!req)
      await payload.update({
        collection: 'sermon-productions',
        id: production.id,
        data: {
          status: 'failed',
          error: 'Could not queue audio preparation. Retry to continue.',
        },
      })
    throw error
  }
}

export async function changeProduction(
  payload: Payload,
  id: number,
  user: User,
  body: Record<string, unknown>,
) {
  return withProduction(payload, id, user, async (production, req) => {
    if (body.token !== production.jobToken)
      throw new APIError(
        'This sermon changed in another session. Reload before continuing.',
        409,
      )
    if (
      body.action === 'discard' &&
      !['published', 'discarded'].includes(production.status)
    ) {
      return payload.update({
        collection: 'sermon-productions',
        id,
        req,
        data: { status: 'discarded', jobToken: randomUUID() },
      })
    }
    const busy = ['importing', 'rendering'].includes(production.status)
    const stalled =
      busy && Date.now() - Date.parse(production.updatedAt) > 45 * 60_000
    if (['published', 'discarded'].includes(production.status))
      throw new APIError(
        'Open this sermon from the archive to prepare another revision.',
        409,
      )
    if (busy && !(body.action === 'retry' && stalled))
      throw new APIError('Audio preparation is still running.', 409)
    if (body.action === 'refresh-calendar') {
      const settings = await payload.findGlobal({ slug: 'sermon-settings', depth: 0, req })
      const defaults = await calendarDefaults(payload, settings, production.sourceName, relationID(production.campus)!, req)
      return payload.update({ collection: 'sermon-productions', id, req, data: {
        metadata: { ...readMetadata(body.metadata || production.metadata), ...defaults.metadata },
        calendarNotice: defaults.notice, jobToken: randomUUID(),
      } })
    }
    if (body.action === 'save') {
      const metadata = readMetadata(body.metadata)
      const cut =
        production.source &&
        typeof body.start === 'number' &&
        typeof body.end === 'number'
          ? { start: body.start, end: body.end }
          : undefined
      if (cut) validateCut(cut.start, cut.end, production.sourceDuration!)
      const cutChanged =
        cut && (cut.start !== production.start || cut.end !== production.end)
      return payload.update({
        collection: 'sermon-productions',
        id,
        req,
        data: {
          metadata: { ...metadata },
          ...cut,
          ...(cutChanged ? { output: null, status: 'editable' } : {}),
          jobToken: randomUUID(),
        },
      })
    }
    if (body.action === 'render' || body.action === 'retry') {
      const source = relationID(production.source)
      const settings = await payload.findGlobal({
        slug: 'sermon-settings',
        depth: 0,
        req,
      })
      const start = body.action === 'retry' ? production.start : body.start
      const end = body.action === 'retry' ? production.end : body.end
      if (source) {
        if (typeof start !== 'number' || typeof end !== 'number')
          throw new APIError('Enter start and end times.', 400)
        validateCut(start, end, production.sourceDuration!)
        if (!settings.outro)
          throw new APIError(
            'An administrator must upload an outro in Sermon Settings.',
            400,
          )
      } else if (!production.driveFileId)
        throw new APIError('Choose a Drive recording first.', 400)
      const next = await payload.update({
        collection: 'sermon-productions',
        id,
        req,
        data: {
          status: source ? 'rendering' : 'importing',
          start: typeof start === 'number' ? start : null,
          end: typeof end === 'number' ? end : null,
          intro: relationID(settings.intro),
          outro: relationID(settings.outro),
          output: null,
          error: null,
          jobToken: randomUUID(),
          ...(body.metadata
            ? { metadata: { ...readMetadata(body.metadata) } }
            : {}),
        },
      })
      await queueProduction(payload, next, req)
      return next
    }
    throw new APIError('Unknown action.', 400)
  })
}

export async function publishProduction(
  payload: Payload,
  id: number,
  user: User,
  token: unknown,
  previewConfirmed: unknown,
) {
  if (previewConfirmed !== true)
    throw new APIError(
      'Listen to the finished audio and confirm the preview before publishing.',
      400,
    )
  const directory = await mkdtemp(path.join(tmpdir(), 'sermon-publish-'))
  try {
    return await withProduction(payload, id, user, async (production, req) => {
      if (production.jobToken !== token)
        throw new APIError(
          'This preview is out of date. Reload before publishing.',
          409,
        )
      if (production.status === 'published') return production
      if (production.status !== 'ready')
        throw new APIError('Prepare and preview the finished audio first.', 400)
      const currentSermon = await checkPublishedRevision(payload, production, req)
      const metadata = readMetadata(production.metadata)
      for (const [key, value] of Object.entries(metadata)) {
        if (
          !['scriptures', 'topics'].includes(key) &&
          (value == null ||
            value === '' ||
            (Array.isArray(value) && !value.length))
        )
          throw new APIError(`Complete ${key} before publishing.`, 400)
      }
      let audioId = relationID(production.publishedAudio)
      const newRecording = Boolean(production.output && production.source)
      if (production.output) {
        const destination = path.join(directory, `${randomUUID()}.mp3`)
        await copyWorkFile(payload, relationID(production.output)!, destination)
        const audio = await payload.create({
          collection: 'sermon-audio',
          filePath: destination,
          data: { duration: production.outputDuration },
          req,
        })
        audioId = audio.id
      }
      if (!audioId) throw new APIError('Prepare audio before publishing.', 400)
      const generatedTopics = currentSermon.generatedTopics
      if (newRecording && Array.isArray(generatedTopics)) metadata.topics = metadata.topics.filter(topic => !generatedTopics.includes(topic))
      req.context.sermonPublication = true
      await payload.update({
        collection: 'sermons',
        id: relationID(production.sermon)!,
        req,
        data: {
          ...metadata,
          audio: audioId,
          duration: production.outputDuration,
          isPublished: true,
          ...(newRecording ? { audioTranscript: null, topicSuggestions: null, generatedTopics: null } : {}),
        },
      })
      const published = await payload.update({
        collection: 'sermon-productions', id, req,
        data: { publishedAudio: audioId, status: 'published' },
      })
      if (newRecording) {
        await payload.create({ collection: 'sermon-transcripts', req, data: {
          sermon: relationID(production.sermon)!, production: id, publishedAudio: audioId,
          title: metadata.title, status: 'transcribing',
        } })
      }
      return published
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
