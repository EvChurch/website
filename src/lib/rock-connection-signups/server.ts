import { randomUUID } from 'node:crypto'

import { connectionSchemaAvailability } from './field-types'
import { isGuid as isRockGuid } from '@/lib/rock-forms/constants'

import { getRockConnectionApiBaseUrl, getRockApiKey } from './config'
import type {
  RockConnectionSignupAttribute,
  RockConnectionSignupInitialization,
  RockConnectionSignupOption,
  RockConnectionSignupRequestBag,
  RockConnectionSignupResult,
  RockConnectionSignupSchema,
  RockObsidianBlockConfig,
  RockPublicAttribute,
} from './types'

export const CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID =
  '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f'

const MAX_RESPONSE_BYTES = 512_000
const MAX_JSON_DEPTH = 16
const MAX_JSON_NODES = 10_000
const REQUEST_TIMEOUT_MS = 10_000

type RockAttributeValue = { Value?: unknown }

type RockBlockMetadata = {
  Guid?: unknown
  IsActive?: unknown
  Name?: unknown
  PageId?: unknown
  LayoutId?: unknown
  SiteId?: unknown
  BlockType?: {
    Guid?: unknown
    Name?: unknown
    IsActive?: unknown
  } | null
  AttributeValues?: Record<string, RockAttributeValue> | null
}

type RockPageMetadata = {
  Id?: unknown
  Guid?: unknown
  InternalName?: unknown
  PageTitle?: unknown
}

type RockOpportunityMetadata = {
  Guid?: unknown
  Name?: unknown
  IsActive?: unknown
  ConnectionTypeId?: unknown
}

type RockConnectionTypeMetadata = {
  Id?: unknown
  IsActive?: unknown
}

type EligibleCandidate = {
  blockGuid: string
  blockName: string
  pageGuid: string
  pageName: string
  opportunityGuid: string
  opportunityName: string
}

type StructuralCandidate = Pick<
  EligibleCandidate,
  'blockGuid' | 'blockName' | 'opportunityGuid'
> & { pageId: number }

type CandidateLoaders = {
  opportunity: (guid: string) => Promise<RockOpportunityMetadata | null>
  page: (pageId: number) => Promise<RockPageMetadata | null>
  connectionType: (
    connectionTypeId: number,
  ) => Promise<RockConnectionTypeMetadata | null>
}

class RockConnectionUnavailableError extends Error {}

export class RockConnectionSignupOutcomeUnknownError extends Error {
  constructor() {
    super('Connection signup outcome is unknown')
  }
}

class RockResponseError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGuid(value: unknown): value is string {
  return typeof value === 'string' && isRockGuid(value)
}

function normalizedGuid(value: string): string {
  return value.toLowerCase()
}

function normalizedLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const label = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return label ? label.slice(0, 160) : fallback
}

function rockBoolean(value: unknown): boolean {
  return (
    value === true ||
    (typeof value === 'string' &&
      ['true', 'yes', '1'].includes(value.toLowerCase()))
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
}: {
  path: string
  params?: Record<string, string>
  method?: 'GET' | 'POST'
  body?: unknown
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
      'Authorization-Token': getRockApiKey(),
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

async function fetchBlockMetadata(
  blockGuid?: string,
): Promise<RockBlockMetadata[]> {
  const typeFilter = `BlockType/Guid eq guid'${CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID}'`
  return parseBlockList(
    await rockRequest({
      path: 'Blocks',
      params: {
        $filter: blockGuid
          ? `${typeFilter} and Guid eq guid'${blockGuid}'`
          : typeFilter,
        $expand: 'BlockType',
        ...(blockGuid ? { $top: '2' } : {}),
        loadAttributes: 'simple',
      },
    }),
  )
}

async function fetchPageMetadata(
  pageId: number,
): Promise<RockPageMetadata | null> {
  const value = await rockRequest({ path: `Pages/${pageId}` })
  return isRecord(value) ? (value as RockPageMetadata) : null
}

async function fetchOpportunity(
  opportunityGuid: string,
): Promise<RockOpportunityMetadata | null> {
  const value = await rockRequest({
    path: 'ConnectionOpportunities',
    params: {
      $filter: `Guid eq guid'${opportunityGuid}'`,
      $top: '2',
    },
  })
  if (!Array.isArray(value) || value.length > 1) return null
  return value.length === 1 && isRecord(value[0])
    ? (value[0] as RockOpportunityMetadata)
    : null
}

async function fetchConnectionType(
  connectionTypeId: number,
): Promise<RockConnectionTypeMetadata | null> {
  const value = await rockRequest({
    path: `ConnectionTypes/${connectionTypeId}`,
  })
  return isRecord(value) ? (value as RockConnectionTypeMetadata) : null
}

function parseStructuralCandidate(
  block: RockBlockMetadata,
): StructuralCandidate | null {
  const blockGuid = block.Guid
  const blockTypeGuid = block.BlockType?.Guid
  const opportunityGuid = attributeValue(
    block.AttributeValues,
    'ConnectionOpportunity',
  )

  if (
    !isGuid(blockGuid) ||
    !isGuid(blockTypeGuid) ||
    normalizedGuid(blockTypeGuid) !==
      CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID ||
    block.IsActive === false ||
    block.BlockType?.IsActive === false ||
    !Number.isSafeInteger(block.PageId) ||
    Number(block.PageId) <= 0 ||
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
    pageId: Number(block.PageId),
    opportunityGuid: normalizedGuid(opportunityGuid),
  }
}

async function resolveCandidate(
  block: RockBlockMetadata,
  loaders: CandidateLoaders = {
    opportunity: fetchOpportunity,
    page: fetchPageMetadata,
    connectionType: fetchConnectionType,
  },
): Promise<EligibleCandidate | null> {
  const candidate = parseStructuralCandidate(block)
  if (!candidate) return null

  const [page, opportunity] = await Promise.all([
    loaders.page(candidate.pageId),
    loaders.opportunity(candidate.opportunityGuid),
  ])
  if (!page || page.Id !== candidate.pageId || !isGuid(page.Guid)) {
    return null
  }

  if (
    !opportunity ||
    !isGuid(opportunity.Guid) ||
    normalizedGuid(opportunity.Guid) !== candidate.opportunityGuid ||
    opportunity.IsActive !== true ||
    !Number.isSafeInteger(opportunity.ConnectionTypeId) ||
    Number(opportunity.ConnectionTypeId) <= 0
  ) {
    return null
  }

  const connectionTypeId = Number(opportunity.ConnectionTypeId)
  const connectionType = await loaders.connectionType(connectionTypeId)
  if (
    !connectionType ||
    connectionType.Id !== connectionTypeId ||
    connectionType.IsActive !== true
  ) {
    return null
  }

  return {
    blockGuid: candidate.blockGuid,
    blockName: candidate.blockName,
    pageGuid: normalizedGuid(page.Guid),
    pageName: normalizedLabel(
      page.PageTitle || page.InternalName,
      normalizedGuid(page.Guid),
    ),
    opportunityGuid: candidate.opportunityGuid,
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
    return {
      value: campus.value,
      text: normalizedLabel(campus.text, campus.value),
    }
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
  if (!connectionSchemaAvailability(attributes).available) {
    throw new RockConnectionUnavailableError('unsupported')
  }

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
  })
  return parseInitialization(value, candidate, sessionGuid, interactionGuid)
}

async function findCandidate(blockGuid: string): Promise<EligibleCandidate> {
  const blocks = await fetchBlockMetadata(blockGuid)
  if (
    blocks.length !== 1 ||
    typeof blocks[0].Guid !== 'string' ||
    normalizedGuid(blocks[0].Guid) !== blockGuid
  ) {
    throw new RockConnectionUnavailableError('not available')
  }
  const candidate = await resolveCandidate(blocks[0])
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

export async function isEligibleRockConnectionSignup(
  blockGuid: string,
): Promise<boolean> {
  await initializeRockConnectionSignup(blockGuid)
  return true
}

export async function listEligibleRockConnectionSignups(): Promise<
  RockConnectionSignupOption[]
> {
  const blocks = await fetchBlockMetadata()
  const options: RockConnectionSignupOption[] = []
  const memoizeAsync = <Key, Value>(fetcher: (key: Key) => Promise<Value>) => {
    const values = new Map<Key, Promise<Value>>()
    return (key: Key) => {
      const existing = values.get(key)
      if (existing) return existing
      const pending = fetcher(key)
      values.set(key, pending)
      return pending
    }
  }
  const loaders: CandidateLoaders = {
    opportunity: memoizeAsync(fetchOpportunity),
    page: memoizeAsync(fetchPageMetadata),
    connectionType: memoizeAsync(fetchConnectionType),
  }

  const workerCount = Math.min(5, blocks.length)
  await Promise.all(
    Array.from({ length: workerCount }, async (_, workerIndex) => {
      for (
        let index = workerIndex;
        index < blocks.length;
        index += workerCount
      ) {
        const candidate = await resolveCandidate(blocks[index], loaders)
        if (!candidate) continue
        try {
          await refreshCandidate(candidate)
        } catch (error) {
          if (
            error instanceof RockConnectionUnavailableError ||
            (error instanceof RockResponseError &&
              error.status >= 400 &&
              error.status < 500)
          ) {
            continue
          }
          throw error
        }
        options.push({
          blockGuid: candidate.blockGuid,
          opportunityGuid: candidate.opportunityGuid,
          label: `${candidate.opportunityName} — ${candidate.pageName} — ${candidate.blockName}`,
        })
      }
    }),
  )

  return options.sort(
    (a, b) => a.label.localeCompare(b.label) || a.blockGuid.localeCompare(b.blockGuid),
  )
}

export async function sendRockConnectionSignup({
  pageGuid,
  blockGuid,
  sessionGuid,
  interactionGuid,
  bag,
}: {
  pageGuid: string
  blockGuid: string
  sessionGuid: string
  interactionGuid: string
  bag: RockConnectionSignupRequestBag
}): Promise<RockConnectionSignupResult> {
  if (![pageGuid, blockGuid, sessionGuid, interactionGuid].every(isGuid)) {
    throw new Error('Invalid Rock connection signup request')
  }

  try {
    const value = await rockRequest({
      path: `v2/BlockActions/${normalizedGuid(pageGuid)}/${normalizedGuid(blockGuid)}/Signup`,
      method: 'POST',
      body: {
        __context: {
          pageParameters: {},
          sessionGuid: normalizedGuid(sessionGuid),
          interactionGuid: normalizedGuid(interactionGuid),
        },
        bag,
      },
    })

    if (!isRecord(value) || !Number.isInteger(value.resultType)) {
      throw new RockConnectionSignupOutcomeUnknownError()
    }
    if (
      value.responseMessage !== undefined &&
      value.responseMessage !== null &&
      (typeof value.responseMessage !== 'string' ||
        value.responseMessage.length > 20_000)
    ) {
      throw new RockConnectionSignupOutcomeUnknownError()
    }
    return {
      resultType: value.resultType as number,
      responseMessage:
        (value.responseMessage as string | null | undefined) ?? null,
    }
  } catch (error) {
    if (error instanceof RockConnectionSignupOutcomeUnknownError) throw error
    if (
      error instanceof RockResponseError &&
      error.status >= 400 &&
      error.status < 500
    ) {
      throw error
    }
    throw new RockConnectionSignupOutcomeUnknownError()
  }
}
