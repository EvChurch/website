import { resolveTopicSuggestion } from '@/lib/sermon-transcripts/workflow'
import type { NextRequest } from 'next/server'
import { isSameOriginRequest } from '@/lib/request-origin'
import { APIError } from 'payload'
import { revalidateTag } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'
import { hasSermonManagerRole } from '@/access/roles'
import { listRecordings, streamRecording } from '@/lib/sermon-management/drive'
import {
  beginProduction,
  changeProduction,
  publishProduction,
} from '@/lib/sermon-management/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authorize(request: Request) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || user.collection !== 'users' || !hasSermonManagerRole(user))
    throw new APIError('Sermon Manager access is required.', 403)
  return { payload, user }
}

function failure(error: unknown) {
  if (error instanceof APIError)
    return Response.json({ error: error.message }, { status: error.status })
  // Adapter errors are curated messages; do not send database errors or stack traces.
  console.error(
    '[Sermon Manager]',
    error instanceof Error ? error.name : 'Unknown error',
  )
  return Response.json(
    {
      error:
        'Unable to complete this action. Check the recording and Sermon Settings, then try again.',
    },
    { status: 400 },
  )
}

export async function GET(request: Request) {
  try {
    const { payload, user } = await authorize(request)
    const query = new URL(request.url).searchParams
    const settings = await payload.findGlobal({
      slug: 'sermon-settings',
      depth: 1,
      overrideAccess: false,
      user,
    })
    if (query.has('listen'))
      return streamRecording(
        settings,
        query.get('listen')!,
        request.headers.get('range'),
      )
    if (query.has('folder'))
      return Response.json(
        await listRecordings(
          settings,
          query.get('folder')!,
          query.get('pageToken') || undefined,
        ),
      )
    if (query.has('production')) {
      const production = await payload.findByID({
        collection: 'sermon-productions',
        id: Number(query.get('production')),
        depth: 1,
        overrideAccess: false,
        user,
      })
      return Response.json({ production })
    }
    const search = query.get('search')?.slice(0, 100)
    const page = Math.max(1, Number(query.get('page')) || 1)
    const [
      sermons,
      productions,
      speakers,
      series,
      topics,
      campuses,
      scriptures,
    ] = await Promise.all([
      payload.find({
        collection: 'sermons',
        depth: 0,
        page,
        limit: 25,
        sort: '-publishedAt',
        ...(search ? { where: { title: { like: search } } } : {}),
        select: { title: true, publishedAt: true, isPublished: true },
        overrideAccess: false,
        user,
      }),
      payload.find({
        collection: 'sermon-productions',
        depth: 0,
        limit: 50,
        sort: '-updatedAt',
        where: { status: { not_in: ['published', 'discarded'] } },
        overrideAccess: false,
        user,
      }),
      payload.find({
        collection: 'speakers',
        depth: 0,
        limit: 1000,
        sort: 'name',
        select: { name: true },
        overrideAccess: false,
        user,
      }),
      payload.find({
        collection: 'sermon-series',
        depth: 0,
        limit: 1000,
        sort: 'title',
        select: { title: true },
        overrideAccess: false,
        user,
      }),
      payload.find({
        collection: 'topics',
        depth: 0,
        limit: 1000,
        sort: 'name',
        select: { name: true },
        overrideAccess: false,
        user,
      }),
      payload.find({
        collection: 'campuses',
        depth: 0,
        limit: 100,
        select: { name: true },
        overrideAccess: false,
        user,
      }),
      payload.find({
        collection: 'scriptures',
        depth: 0,
        limit: 100,
        sort: 'name',
        select: { name: true },
        overrideAccess: false,
        user,
      }),
    ])
    return Response.json({
      sermons,
      productions: productions.docs,
      speakers: speakers.docs,
      series: series.docs,
      topics: topics.docs,
      campuses: campuses.docs,
      scriptures: scriptures.docs,
      folders: settings.driveFolders || [],
      topicReviews: (await payload.find({ collection: 'sermons', depth: 0, limit: 50, where: { topicSuggestions: { exists: true } }, select: { title: true, topicSuggestions: true }, overrideAccess: false, user })).docs.filter(sermon => Array.isArray(sermon.topicSuggestions) && sermon.topicSuggestions.length),
      configured: Boolean(
        settings.outro &&
        settings.driveFolders?.length &&
        process.env.SERMON_DRIVE_SERVICE_ACCOUNT_JSON,
      ),
    })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request))
      throw new APIError(
        'Use the Sermon Manager dashboard to make changes.',
        403,
      )
    const { payload, user } = await authorize(request)
    const body = (await request.json()) as Record<string, unknown>
    if (body.action === 'approve-topic' || body.action === 'dismiss-topic') {
      if (typeof body.sermonId !== 'number' || !Number.isSafeInteger(body.sermonId) || body.sermonId < 1) throw new APIError('Choose a sermon.', 400)
      return Response.json(await resolveTopicSuggestion(payload, body.sermonId, body.name, body.action === 'approve-topic'))
    }
    if (body.action === 'begin') {
      const sermonId =
        typeof body.sermonId === 'number' &&
        Number.isSafeInteger(body.sermonId) &&
        body.sermonId > 0
          ? body.sermonId
          : undefined
      const fileId = typeof body.fileId === 'string' ? body.fileId : undefined
      if (!sermonId && !fileId)
        throw new APIError('Choose a recording or an existing sermon.', 400)
      return Response.json({
        id: await beginProduction(
          payload,
          sermonId,
          fileId,
          body.metadata,
          typeof body.previousProductionId === 'number'
            ? body.previousProductionId
            : undefined,
          body.previousToken,
        ),
      })
    }
    if (
      typeof body.id !== 'number' ||
      !Number.isSafeInteger(body.id) ||
      body.id < 1
    )
      throw new APIError('Choose a sermon.', 400)
    const result =
      body.action === 'publish'
        ? await publishProduction(
            payload,
            body.id,
            user,
            body.token,
            body.previewConfirmed,
          )
        : await changeProduction(payload, body.id, user, body)
    if (body.action === 'publish') revalidateTag('sermons', { expire: 0 })
    return Response.json({ id: result.id })
  } catch (error) {
    return failure(error)
  }
}
