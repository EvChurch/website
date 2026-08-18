import { getPayloadClient } from '@/lib/payload'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import type { RockForm } from '@/payload-types'
import { isGuid } from '@/lib/rock-forms/constants'
import { getPayloadMediaUrl, type PayloadMediaImage } from '@/lib/payload-media'

import { classifyLauncherHref, launcherPlainText, sanitizeLauncherHtml } from './sanitize'
import type {
  LauncherCampus,
  LauncherData,
  LauncherItem,
  LauncherItemAction,
} from './types'

type PayloadFindResult = { docs: unknown[] }

const NON_WEBSITE_CAMPUS_GUIDS = new Set([
  '94d77e80-8a6d-4cc0-95e5-e25fbf47062f', // Rock's Online campus
])

interface LauncherPayloadClient {
  find(args: Record<string, unknown>): Promise<PayloadFindResult>
  findGlobal(args: Record<string, unknown>): Promise<unknown>
}

interface RelationValue {
  id?: number | string
  slug?: string | null
  name?: string | null
}

interface ServiceGuideRecord {
  id?: number | string
  rockId?: number | string
  title?: string | null
  content?: string | null
  promotionalBlurb?: string | null
  bannerImageGuid?: string | null
  status?: number | string | null
  startDateTime?: string | null
  expireDateTime?: string | null
  priority?: number | null
  sourceOrder?: number | null
  campusGuids?: Array<{ guid?: string | null }> | null
  campuses?: Array<number | string | RelationValue> | null
  directLink?: string | null
  workflowGuid?: string | null
  connectionBlockGuid?: string | null
  event?: number | string | RelationValue | null
}

type RockFormRecord = Partial<
  Pick<
    RockForm,
    'title' | 'slug' | 'body' | 'image' | 'workflowTypeGuid' | 'published'
  >
>

const select = {
  rockId: true,
  title: true,
  content: true,
  promotionalBlurb: true,
  bannerImageGuid: true,
  status: true,
  startDateTime: true,
  expireDateTime: true,
  priority: true,
  sourceOrder: true,
  campusGuids: true,
  campuses: true,
  directLink: true,
  workflowGuid: true,
  connectionBlockGuid: true,
  event: true,
}

const rockFormSelect = {
  title: true,
  slug: true,
  body: true,
  image: true,
  workflowTypeGuid: true,
  published: true,
}

function asRecord(value: unknown): ServiceGuideRecord {
  return typeof value === 'object' && value !== null
    ? (value as ServiceGuideRecord)
    : {}
}

function asRockFormRecord(value: unknown): RockFormRecord {
  return typeof value === 'object' && value !== null
    ? (value as RockFormRecord)
    : {}
}

function relation(value: unknown): RelationValue | null {
  return typeof value === 'object' && value !== null
    ? (value as RelationValue)
    : null
}

function normalizedGuid(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const guid = value.trim().toLowerCase()
  return isGuid(guid) ? guid : null
}

function isActiveStatus(status: ServiceGuideRecord['status']): boolean {
  return status === 1 || status === '1' || status === 'active'
}

function displayTitle(title: string): string {
  return title
    .replace(/\s*\((?:UC|CT|NS)\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentWithoutRepeatedTitle(content: string, title: string): string {
  const heading = content.match(/^\s*<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/i)
  if (!heading) return content

  const headingText = displayTitle(launcherPlainText(sanitizeLauncherHtml(heading[2])))
  return headingText.localeCompare(displayTitle(title), undefined, { sensitivity: 'base' }) === 0
    ? content.slice(heading[0].length)
    : content
}

function bannerImageUrl(value: unknown): string | null {
  const guid = normalizedGuid(value)
  return guid
    ? `https://rock.ev.church/GetImage.ashx?Guid=${guid}&w=1200`
    : null
}

function sanitizedRecordContent(record: ServiceGuideRecord): string {
  const content = record.content?.trim()
  if (!content) return ''
  return sanitizeLauncherHtml(
    record.title ? contentWithoutRepeatedTitle(content, record.title) : content,
  )
}

export function isCurrentlyEligible(
  record: ServiceGuideRecord,
  now = new Date(),
): boolean {
  if (!isActiveStatus(record.status)) return false
  const timestamp = now.getTime()
  const startsAt = record.startDateTime
    ? new Date(record.startDateTime).getTime()
    : null
  const expiresAt = record.expireDateTime
    ? new Date(record.expireDateTime).getTime()
    : null

  if (startsAt !== null && (!Number.isFinite(startsAt) || startsAt > timestamp)) {
    return false
  }
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= timestamp)) {
    return false
  }
  return true
}

function resolveLauncherActionWithContent(
  record: ServiceGuideRecord,
  sanitizedContent: string,
): LauncherItemAction | null {
  const imageUrl = bannerImageUrl(record.bannerImageGuid)
  const href = record.directLink
    ? classifyLauncherHref(record.directLink)
    : null
  if (href) return { type: 'directLink', href }

  const connectionBlockGuid = normalizedGuid(record.connectionBlockGuid)
  if (connectionBlockGuid) {
    return {
      type: 'connection',
      blockGuid: connectionBlockGuid,
      ...(imageUrl ? { imageUrl } : {}),
    }
  }

  const workflowTypeGuid = normalizedGuid(record.workflowGuid)
  if (workflowTypeGuid) {
    return {
      type: 'workflow',
      workflowTypeGuid,
      ...(imageUrl ? { imageUrl } : {}),
    }
  }

  const eventSlug = relation(record.event)?.slug?.trim()
  if (eventSlug) {
    return { type: 'event', href: `/events/${encodeURIComponent(eventSlug)}` }
  }

  if (!launcherPlainText(sanitizedContent)) return null
  return {
    type: 'content',
    html: sanitizedContent,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

export function resolveLauncherAction(
  record: ServiceGuideRecord,
): LauncherItemAction | null {
  return resolveLauncherActionWithContent(
    record,
    sanitizedRecordContent(record),
  )
}

function campusSlugs(record: ServiceGuideRecord): string[] {
  const slugs = (record.campuses ?? [])
    .map((campus) => relation(campus)?.slug?.trim().toLowerCase())
    .filter((slug): slug is string => Boolean(slug) && slug !== 'online')
  return [...new Set(slugs)]
}

function hasCompleteCampusResolution(record: ServiceGuideRecord): boolean {
  const assignedSourceGuids = new Set(
    (record.campusGuids ?? [])
      .map(({ guid }) => normalizedGuid(guid))
      .filter((guid): guid is string => guid !== null),
  )
  if (assignedSourceGuids.size === 0) return true

  const websiteSourceGuids = [...assignedSourceGuids].filter(
    (guid) => !NON_WEBSITE_CAMPUS_GUIDS.has(guid),
  )
  if (websiteSourceGuids.length === 0) return false
  return campusSlugs(record).length === websiteSourceGuids.length
}

export function toLauncherItem(record: ServiceGuideRecord): LauncherItem | null {
  const sourceTitle = record.title?.trim()
  const title = sourceTitle ? displayTitle(sourceTitle) : ''
  const sanitizedContent = sanitizedRecordContent(record)
  const action = resolveLauncherActionWithContent(record, sanitizedContent)
  if (!title || !action) return null

  const promotionalBlurb = record.promotionalBlurb?.trim() || undefined
  const contentText = launcherPlainText(sanitizedContent)
  const searchText = [sourceTitle, promotionalBlurb, contentText]
    .filter(Boolean)
    .join(' ')
  const id = String(record.rockId ?? record.id ?? '')
  if (!id) return null

  return {
    id,
    title,
    ...(promotionalBlurb ? { promotionalBlurb } : {}),
    ...(searchText ? { searchText } : {}),
    campusSlugs: campusSlugs(record),
    action,
  }
}

export function rockFormToLauncherItem(record: RockFormRecord): LauncherItem | null {
  const title = record.title?.trim()
  const slug = record.slug?.trim()
  const workflowTypeGuid = normalizedGuid(record.workflowTypeGuid)
  if (!record.published || !title || !slug || !workflowTypeGuid) return null

  const imageUrl =
    record.image && typeof record.image === 'object'
      ? getPayloadMediaUrl(record.image, 'large') ?? record.image.url ?? undefined
      : undefined

  return {
    id: slug,
    title,
    campusSlugs: [],
    action: {
      type: 'workflow',
      workflowTypeGuid,
      ...(imageUrl ? { imageUrl } : {}),
      ...(record.body ? { body: record.body } : {}),
    },
  }
}

function compareRecords(a: ServiceGuideRecord, b: ServiceGuideRecord): number {
  const priority = (b.priority ?? 0) - (a.priority ?? 0)
  if (priority !== 0) return priority
  const order = (a.sourceOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.sourceOrder ?? Number.MAX_SAFE_INTEGER)
  if (order !== 0) return order
  return String(a.rockId ?? a.id ?? '').localeCompare(
    String(b.rockId ?? b.id ?? ''),
    undefined,
    { numeric: true },
  )
}

async function hasSuccessfulSnapshot(payload: LauncherPayloadClient): Promise<boolean> {
  try {
    const value = await payload.findGlobal({
      slug: 'service-guide-sync-state',
      depth: 0,
      overrideAccess: true,
    })
    if (typeof value !== 'object' || value === null) return false
    const lastSuccessfulSyncAt = (value as { lastSuccessfulSyncAt?: unknown })
      .lastSuccessfulSyncAt
    return typeof lastSuccessfulSyncAt === 'string' && lastSuccessfulSyncAt.length > 0
  } catch {
    return false
  }
}

function toCampus(value: unknown): LauncherCampus | null {
  const campus = relation(value)
  const slug = campus?.slug?.trim().toLowerCase()
  const name = campus?.name?.trim()
  return slug && name ? { slug, name } : null
}

async function findEligibleServiceGuideRecords(
  payload: LauncherPayloadClient,
  now: Date,
): Promise<ServiceGuideRecord[]> {
  const result = await payload.find({
    collection: 'service-guide-items',
    depth: 1,
    limit: 500,
    overrideAccess: true,
    select,
  })
  return result.docs
    .map(asRecord)
    .filter(
      (record) =>
        isCurrentlyEligible(record, now) && hasCompleteCampusResolution(record),
    )
}

async function findPublishedRockForms(
  payload: LauncherPayloadClient,
): Promise<RockFormRecord[]> {
  try {
    const result = await payload.find({
      collection: 'rock-forms',
      depth: 1,
      limit: 500,
      overrideAccess: true,
      sort: 'title',
      select: rockFormSelect,
      where: { published: { equals: true } },
    })
    return result.docs.map(asRockFormRecord)
  } catch {
    return []
  }
}

async function hasPublishedRockFormWorkflow(
  payload: LauncherPayloadClient,
  workflowTypeGuid: string,
): Promise<boolean> {
  try {
    const result = await payload.find({
      collection: 'rock-forms',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      select: { workflowTypeGuid: true, published: true },
      where: {
        and: [
          { published: { equals: true } },
          { workflowTypeGuid: { equals: workflowTypeGuid } },
        ],
      },
    })
    return result.docs
      .map(asRockFormRecord)
      .some(
        (form) =>
          form.published && normalizedGuid(form.workflowTypeGuid) === workflowTypeGuid,
      )
  } catch {
    return false
  }
}

async function loadLauncherDataAt(now: Date): Promise<LauncherData> {
  try {
    const payload = (await getPayloadClient()) as unknown as LauncherPayloadClient
    const [records, rockForms, campusResult, serviceGuideAvailable] = await Promise.all([
      findEligibleServiceGuideRecords(payload, now),
      findPublishedRockForms(payload),
      payload.find({
        collection: 'campuses',
        depth: 0,
        limit: 100,
        overrideAccess: true,
        sort: 'order',
        select: { name: true, slug: true },
        where: { isActive: { equals: true } },
      }),
      hasSuccessfulSnapshot(payload),
    ])

    const serviceGuideItems = records
      .sort(compareRecords)
      .map(toLauncherItem)
      .filter((item): item is LauncherItem => item !== null)
    const rockFormItems = rockForms
      .map(rockFormToLauncherItem)
      .filter((item): item is LauncherItem => item !== null)
    const managedWorkflowGuids = new Set(
      rockFormItems.flatMap((item) =>
        item.action.type === 'workflow' ? [item.action.workflowTypeGuid] : [],
      ),
    )
    const uniqueServiceGuideItems = serviceGuideItems.filter(
      (item) =>
        item.action.type !== 'workflow' ||
        !managedWorkflowGuids.has(item.action.workflowTypeGuid),
    )
    const campuses = campusResult.docs
      .map(toCampus)
      .filter((campus): campus is LauncherCampus => campus !== null)

    return {
      available: serviceGuideAvailable || rockFormItems.length > 0,
      campuses,
      items: [...uniqueServiceGuideItems, ...rockFormItems],
    }
  } catch {
    return { available: false, campuses: [], items: [] }
  }
}

const getCachedLauncherData = unstable_cache(
  () => loadLauncherDataAt(new Date()),
  ['launcher-data-with-rock-forms'],
  {
    tags: [
      CACHE_TAGS.serviceGuide,
      CACHE_TAGS.rockForms,
      CACHE_TAGS.campuses,
      CACHE_TAGS.events,
    ],
    revalidate: 600,
  },
)

export async function loadLauncherData(now?: Date): Promise<LauncherData> {
  return now ? loadLauncherDataAt(now) : getCachedLauncherData()
}

async function hasWinningAction(
  predicate: (action: LauncherItemAction) => boolean,
  now = new Date(),
): Promise<boolean> {
  const payload = (await getPayloadClient()) as unknown as LauncherPayloadClient
  if (!(await hasSuccessfulSnapshot(payload))) return false
  const records = await findEligibleServiceGuideRecords(payload, now)
  return records.some((record) => {
      const action = resolveLauncherAction(record)
      return action !== null && predicate(action)
    })
}

export async function isPublishedLauncherWorkflow(
  workflowTypeGuid: string,
): Promise<boolean> {
  const guid = normalizedGuid(workflowTypeGuid)
  if (!guid) return false
  const payload = (await getPayloadClient()) as unknown as LauncherPayloadClient
  if (await hasPublishedRockFormWorkflow(payload, guid)) return true
  return hasWinningAction(
    (action) => action.type === 'workflow' && action.workflowTypeGuid === guid,
  )
}

export async function isPublishedLauncherConnection(
  blockGuid: string,
): Promise<boolean> {
  const guid = normalizedGuid(blockGuid)
  if (!guid) return false
  return hasWinningAction(
    (action) => action.type === 'connection' && action.blockGuid === guid,
  )
}
