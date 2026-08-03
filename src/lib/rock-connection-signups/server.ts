import { randomUUID } from 'node:crypto'

import {
  getRockConnectionApiBaseUrl,
  getRockDiscoveryApiKey,
  getRockEdgeAccessHeaders,
} from './config'
import type {
  RockConnectionSignupAttribute,
  RockConnectionSignupInitialization,
  RockConnectionSignupOption,
  RockConnectionSignupSchema,
  RockObsidianBlockConfig,
  RockPublicAttribute,
} from './types'

export const CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID =
  '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f'

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_RESPONSE_BYTES = 512_000
const MAX_JSON_DEPTH = 16
const MAX_JSON_NODES = 10_000
const REQUEST_TIMEOUT_MS = 10_000

const SUPPORTED_FIELD_TYPES = new Set([
  '9c204cd0-1233-41c5-818a-c5da439445aa', // Text
  'c28c7bf3-a552-4d77-9408-dedcf760ced0', // Memo
  '7525c4cb-ee6b-41d4-9b64-a08048d5a5c0', // Single Select
  'bd0d9b57-2a41-4490-89ff-f01dab7d4904', // Multi Select
  '1edafded-dfe6-4334-b019-6eecba89e05a', // Boolean
  '6b6aa175-4758-453f-8d83-fcd8044b5f36', // Date
  'a75dfc58-7a1b-4799-bf31-451b2bbe38ff', // Integer
  '3ee69cbc-35ce-4496-88cc-8327a447603f', // Currency
  '6b1908ec-12a2-463a-a7bd-970ce0faf097', // Phone
  'c0d0d7e2-c3b0-4004-abea-4bbfad10d5d2', // URL
])

type RockAttributeValue = { Value?: unknown }

type RockBlockMetadata = {
  Guid?: unknown
  Name?: unknown
  PageId?: unknown
  LayoutId?: unknown
  SiteId?: unknown
  BlockType?: {
    Guid?: unknown
    Name?: unknown
    IsActive?: unknown
  } | null
  Page?: {
    Guid?: unknown
    InternalName?: unknown
    PageTitle?: unknown
  } | null
  AttributeValues?: Record<string, RockAttributeValue> | null
}

type RockOpportunityMetadata = {
  Guid?: unknown
  Name?: unknown
  IsActive?: unknown
  ConnectionType?: { Name?: unknown; IsActive?: unknown } | null
}

type EligibleCandidate = {
  blockGuid: string
  blockName: string
  pageGuid: string
  pageName: string
  opportunityGuid: string
  opportunityName: string
}

class RockConnectionUnavailableError extends Error {}

class RockResponseError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGuid(value: unknown): value is string {
  return typeof value === 'string' && GUID_PATTERN.test(value)
}

function normalizedGuid(value: string): string {
  return value.toLowerCase()
}

function normalizedLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const label = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return label ? label.slice(0, 160) : fallback
}

function rockBoolean(value: unknown): boolean {
  return (
    value === true ||
    (typeof value === 'string' && ['true', 'yes', '1'].includes(value.toLowerCase()))
  )
}

function attributeValue(
  values: RockBlockMetadata['AttributeValues'],
  key: string,
): unknown {
  return values?.[key]?.Value
}

function assertBoundedJson(value: unknown): void {
  let nodes = 0
  const visit = (current: unknown, depth: number): void => {
    nodes += 1
    if (nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) {
      throw new Error('Rock returned an invalid response')
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item, depth + 1)
    } else if (isRecord(current)) {
      for (const item of Object.values(current)) visit(item, depth + 1)
    }
  }
  visit(value, 0)
}

async function parseBoundedJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new RockResponseError(response.status, 'Rock request was rejected')
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  if (!contentType.startsWith('application/json')) {
    throw new Error('Rock returned an invalid response')
  }

  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('Rock returned an invalid response')
  }

  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('Rock returned an invalid response')
  }

  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch {
    throw new Error('Rock returned an invalid response')
  }
  assertBoundedJson(value)
  return value
}

async function rockRequest({
  path,
  params,
  method = 'GET',
  body,
  authenticated,
}: {
  path: string
  params?: Record<string, string>
  method?: 'GET' | 'POST'
  body?: unknown
  authenticated: boolean
}): Promise<unknown> {
  const baseUrl = getRockConnectionApiBaseUrl()
  const url = new URL(`${baseUrl}/${path}`)
  if (url.origin !== new URL(baseUrl).origin) {
    throw new Error('Invalid Rock request target')
  }
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: 'application/json',
      ...(authenticated
        ? { 'Authorization-Token': getRockDiscoveryApiKey() }
        : getRockEdgeAccessHeaders()),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  return parseBoundedJson(response)
}

function parseBlockList(value: unknown): RockBlockMetadata[] {
  if (!Array.isArray(value) || value.length > 500) {
    throw new Error('Rock returned an invalid block list')
  }
  return value.filter(isRecord) as RockBlockMetadata[]
}

async function fetchBlockMetadata(): Promise<RockBlockMetadata[]> {
  return parseBlockList(
    await rockRequest({
      path: 'Blocks',
      params: {
        '$filter': `BlockType/Guid eq guid'${CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID}'`,
        '$expand': 'BlockType,Page',
        loadAttributes: 'simple',
      },
      authenticated: true,
    }),
  )
}

async function fetchOpportunity(
  opportunityGuid: string,
): Promise<RockOpportunityMetadata | null> {
  const value = await rockRequest({
    path: 'ConnectionOpportunities',
    params: {
      '$filter': `Guid eq guid'${opportunityGuid}'`,
      '$expand': 'ConnectionType',
      '$top': '2',
    },
    authenticated: true,
  })
  if (!Array.isArray(value) || value.length > 1) return null
  return value.length === 1 && isRecord(value[0])
    ? (value[0] as RockOpportunityMetadata)
    : null
}

function parseStructuralCandidate(
  block: RockBlockMetadata,
): Omit<EligibleCandidate, 'opportunityName'> | null {
  const blockGuid = block.Guid
  const pageGuid = block.Page?.Guid
  const blockTypeGuid = block.BlockType?.Guid
  const opportunityGuid = attributeValue(
    block.AttributeValues,
    'ConnectionOpportunity',
  )

  if (
    !isGuid(blockGuid) ||
    !isGuid(pageGuid) ||
    !isGuid(blockTypeGuid) ||
    normalizedGuid(blockTypeGuid) !==
      CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID ||
    block.BlockType?.IsActive === false ||
    typeof block.PageId !== 'number' ||
    block.LayoutId != null ||
    block.SiteId != null ||
    !isGuid(opportunityGuid) ||
    !rockBoolean(
      attributeValue(block.AttributeValues, 'ExcludeNonPublicAttributes'),
    ) ||
    !rockBoolean(attributeValue(block.AttributeValues, 'DisableCaptchaSupport'))
  ) {
    return null
  }

  return {
    blockGuid: normalizedGuid(blockGuid),
    blockName: normalizedLabel(block.Name, normalizedGuid(blockGuid)),
    pageGuid: normalizedGuid(pageGuid),
    pageName: normalizedLabel(
      block.Page?.PageTitle || block.Page?.InternalName,
      normalizedGuid(pageGuid),
    ),
    opportunityGuid: normalizedGuid(opportunityGuid),
  }
}

async function resolveCandidate(
  block: RockBlockMetadata,
): Promise<EligibleCandidate | null> {
  const candidate = parseStructuralCandidate(block)
  if (!candidate) return null

  const opportunity = await fetchOpportunity(candidate.opportunityGuid)
  if (
    !opportunity ||
    !isGuid(opportunity.Guid) ||
    normalizedGuid(opportunity.Guid) !== candidate.opportunityGuid ||
    opportunity.IsActive !== true ||
    opportunity.ConnectionType?.IsActive !== true
  ) {
    return null
  }

  return {
    ...candidate,
    opportunityName: normalizedLabel(
      opportunity.Name,
      candidate.opportunityGuid,
    ),
  }
}

function parseAttribute(
  mapKey: string,
  value: unknown,
): RockConnectionSignupAttribute {
  if (!isRecord(value)) throw new RockConnectionUnavailableError('unsupported')
  const attribute = value as RockPublicAttribute
  const attributeGuid = attribute.attributeGuid
  const fieldTypeGuid = attribute.fieldTypeGuid
  const key = attribute.key

  if (
    !isGuid(attributeGuid) ||
    !isGuid(fieldTypeGuid) ||
    !SUPPORTED_FIELD_TYPES.has(normalizedGuid(fieldTypeGuid)) ||
    typeof key !== 'string' ||
    key !== mapKey ||
    key.length === 0 ||
    key.length > 100 ||
    typeof attribute.isRequired !== 'boolean' ||
    !Number.isInteger(attribute.order) ||
    attribute.order < -10_000 ||
    attribute.order > 10_000
  ) {
    throw new RockConnectionUnavailableError('unsupported')
  }

  const configurationValues = attribute.configurationValues ?? {}
  if (
    !isRecord(configurationValues) ||
    Object.keys(configurationValues).length > 100 ||
    Object.values(configurationValues).some(
      (item) => typeof item !== 'string' || item.length > 20_000,
    )
  ) {
    throw new RockConnectionUnavailableError('unsupported')
  }

  return {
    attributeGuid: normalizedGuid(attributeGuid),
    fieldTypeGuid: normalizedGuid(fieldTypeGuid),
    key,
    name: normalizedLabel(attribute.name, key),
    description: normalizedLabel(attribute.description, ''),
    isRequired: attribute.isRequired,
    order: attribute.order,
    configurationValues: configurationValues as Record<string, string>,
  }
}

function parseInitialization(
  value: unknown,
  candidate: EligibleCandidate,
  sessionGuid: string,
  interactionGuid: string,
): RockConnectionSignupSchema {
  if (!isRecord(value)) throw new RockConnectionUnavailableError('invalid')
  const config = value as RockObsidianBlockConfig
  if (
    !isGuid(config.blockGuid) ||
    normalizedGuid(config.blockGuid) !== candidate.blockGuid ||
    !isGuid(config.blockTypeGuid) ||
    normalizedGuid(config.blockTypeGuid) !==
      CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID ||
    !isRecord(config.configurationValues)
  ) {
    throw new RockConnectionUnavailableError('invalid')
  }

  const initialization =
    config.configurationValues as RockConnectionSignupInitialization
  if (
    initialization.disableCaptchaSupport !== true ||
    typeof initialization.displayHomePhone !== 'boolean' ||
    typeof initialization.displayMobilePhone !== 'boolean' ||
    initialization.errorMessage ||
    !Array.isArray(initialization.campuses) ||
    !isRecord(initialization.attributes)
  ) {
    throw new RockConnectionUnavailableError('invalid')
  }

  if (initialization.campuses.length > 100) {
    throw new RockConnectionUnavailableError('invalid')
  }
  const campuses = initialization.campuses.map((campus) => {
    if (
      !isRecord(campus) ||
      typeof campus.value !== 'string' ||
      !/^\d{1,10}$/.test(campus.value) ||
      typeof campus.text !== 'string' ||
      campus.text.length > 160
    ) {
      throw new RockConnectionUnavailableError('invalid')
    }
    return { value: campus.value, text: normalizedLabel(campus.text, campus.value) }
  })

  const selectedCampusId = initialization.selectedCampusId ?? null
  if (
    selectedCampusId !== null &&
    (!Number.isSafeInteger(selectedCampusId) ||
      !campuses.some((campus) => campus.value === String(selectedCampusId)))
  ) {
    throw new RockConnectionUnavailableError('invalid')
  }

  const attributes = Object.entries(initialization.attributes)
    .map(([key, attribute]) => parseAttribute(key, attribute))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

  return {
    pageGuid: candidate.pageGuid,
    blockGuid: candidate.blockGuid,
    blockTypeGuid: CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID,
    opportunityGuid: candidate.opportunityGuid,
    opportunityName: candidate.opportunityName,
    sessionGuid,
    interactionGuid,
    attributes,
    campuses,
    commentFieldLabel: normalizedLabel(
      initialization.commentFieldLabel,
      'Comments',
    ),
    disableCaptchaSupport: true,
    displayHomePhone: initialization.displayHomePhone,
    displayMobilePhone: initialization.displayMobilePhone,
    selectedCampusId,
    firstName: '',
    lastName: '',
    email: '',
    homePhone: null,
    mobilePhone: null,
  }
}

async function refreshCandidate(
  candidate: EligibleCandidate,
): Promise<RockConnectionSignupSchema> {
  const sessionGuid = randomUUID()
  const interactionGuid = randomUUID()
  const value = await rockRequest({
    path: `v2/BlockActions/${candidate.pageGuid}/${candidate.blockGuid}/RefreshObsidianBlockInitialization`,
    method: 'POST',
    body: {
      __context: {
        pageParameters: {},
        sessionGuid,
        interactionGuid,
      },
    },
    authenticated: false,
  })
  return parseInitialization(value, candidate, sessionGuid, interactionGuid)
}

async function findCandidate(blockGuid: string): Promise<EligibleCandidate> {
  const blocks = await fetchBlockMetadata()
  const matching = blocks.filter(
    (block) =>
      typeof block.Guid === 'string' &&
      block.Guid.toLowerCase() === blockGuid.toLowerCase(),
  )
  if (matching.length !== 1) {
    throw new RockConnectionUnavailableError('not available')
  }
  const candidate = await resolveCandidate(matching[0])
  if (!candidate) throw new RockConnectionUnavailableError('not available')
  return candidate
}

export async function initializeRockConnectionSignup(
  blockGuid: string,
): Promise<RockConnectionSignupSchema> {
  if (!isGuid(blockGuid)) throw new Error('A valid block GUID is required')
  try {
    const candidate = await findCandidate(normalizedGuid(blockGuid))
    return await refreshCandidate(candidate)
  } catch (error) {
    if (error instanceof RockConnectionUnavailableError) {
      throw new Error('This Rock connection signup is not available')
    }
    throw error
  }
}

export async function listEligibleRockConnectionSignups(): Promise<
  RockConnectionSignupOption[]
> {
  const blocks = await fetchBlockMetadata()
  const options: RockConnectionSignupOption[] = []

  for (const block of blocks) {
    const candidate = await resolveCandidate(block)
    if (!candidate) continue
    try {
      await refreshCandidate(candidate)
    } catch (error) {
      if (
        error instanceof RockConnectionUnavailableError ||
        (error instanceof RockResponseError && error.status >= 400 && error.status < 500)
      ) {
        continue
      }
      throw error
    }
    options.push({
      blockGuid: candidate.blockGuid,
      label: `${candidate.opportunityName} — ${candidate.pageName} — ${candidate.blockName}`,
    })
  }

  return options.sort((a, b) => a.label.localeCompare(b.label))
}
