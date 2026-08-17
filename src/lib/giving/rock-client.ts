export const AUTH0_ROCK_ENTITY_TYPE_GUID =
  '9D2EDAC7-1051-40A1-BE28-32C0ABD1B28F'

const MAX_RESPONSE_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_GET_RETRIES = 1
const MAX_SUBJECT_LENGTH = 249
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

export type GivingRockErrorCode =
  | 'configuration-invalid'
  | 'request-rejected'
  | 'request-unavailable'
  | 'response-invalid'
  | 'identity-not-found'
  | 'identity-ambiguous'
  | 'identity-invalid'
  | 'create-unknown'

export class GivingRockClientError extends Error {
  constructor(
    public readonly code: GivingRockErrorCode,
    public readonly outcome: 'failed' | 'unknown' = 'failed',
    public readonly status?: number,
  ) {
    super(`Giving Rock request failed: ${code}`)
    this.name = 'GivingRockClientError'
  }
}

export interface GivingRockPerson {
  id: number
  primaryAliasId: number
  guid: string
  firstName: string | null
  lastName: string | null
  email: string | null
}

export interface CreateGivingRockPersonInput {
  firstName: string
  lastName: string
  email: string
  guid: string
}

export interface GivingRockClient {
  findActivePeopleByEmail(normalisedEmail: string): Promise<GivingRockPerson[]>
  resolveSignedInPerson(subject: string): Promise<GivingRockPerson>
  createPerson(input: CreateGivingRockPersonInput): Promise<GivingRockPerson>
  findPersonByGuid(guid: string): Promise<GivingRockPerson | null>
  getPersonByAlias(personAliasId: number): Promise<GivingRockPerson>
}

interface GivingRockClientOptions {
  apiUrl?: string
  apiKey?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  getRetries?: number
  retryDelayMs?: number
}

interface RequestOptions {
  endpoint: string
  params?: Record<string, string>
  method?: 'GET' | 'POST'
  body?: unknown
  create?: boolean
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalText(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || typeof value === 'string'
}

function cleanOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && !CONTROL_CHARACTERS.test(text) ? text : null
}

function parsePerson(value: unknown): GivingRockPerson | null {
  if (!record(value)) return null
  if (
    !positiveInteger(value.Id) ||
    !positiveInteger(value.PrimaryAliasId) ||
    typeof value.Guid !== 'string' ||
    !UUID_PATTERN.test(value.Guid) ||
    !optionalText(value.FirstName) ||
    !optionalText(value.NickName) ||
    !optionalText(value.LastName) ||
    !optionalText(value.Email)
  ) {
    return null
  }

  return {
    id: value.Id,
    primaryAliasId: value.PrimaryAliasId,
    guid: value.Guid.toLowerCase(),
    firstName: cleanOptionalText(value.NickName) ?? cleanOptionalText(value.FirstName),
    lastName: cleanOptionalText(value.LastName),
    email: cleanOptionalText(value.Email),
  }
}

function requirePerson(value: unknown) {
  const person = parsePerson(value)
  if (!person) throw new GivingRockClientError('response-invalid')
  return person
}

function validateConfiguration(apiUrlValue: string, apiKey: string) {
  let url: URL
  try {
    url = new URL(apiUrlValue)
  } catch {
    throw new GivingRockClientError('configuration-invalid')
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/+$/u, '') !== '/api' ||
    !apiKey ||
    CONTROL_CHARACTERS.test(apiKey)
  ) {
    throw new GivingRockClientError('configuration-invalid')
  }
  return new URL(`${url.origin}/api/`)
}

function escapeODataString(value: string) {
  return value.replaceAll("'", "''")
}

function validSubject(value: string) {
  return value.length > 0 && value.length <= MAX_SUBJECT_LENGTH && !CONTROL_CHARACTERS.test(value)
}

function validGuid(value: string) {
  return UUID_PATTERN.test(value)
}

function transient(error: unknown) {
  return error instanceof TypeError ||
    (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))
}

async function discardBody(response: Response) {
  try { await response.body?.cancel() } catch { /* best-effort resource release */ }
}

async function boundedJson(response: Response, create: boolean): Promise<unknown> {
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    await discardBody(response)
    throw new GivingRockClientError(create ? 'create-unknown' : 'response-invalid', create ? 'unknown' : 'failed')
  }
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await discardBody(response)
    throw new GivingRockClientError(create ? 'create-unknown' : 'response-invalid', create ? 'unknown' : 'failed')
  }
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new GivingRockClientError(create ? 'create-unknown' : 'response-invalid', create ? 'unknown' : 'failed')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new GivingRockClientError(create ? 'create-unknown' : 'response-invalid', create ? 'unknown' : 'failed')
  }
}

export function createGivingRockClient(options: GivingRockClientOptions = {}): GivingRockClient {
  const apiKey = options.apiKey ?? process.env.ROCK_API_KEY ?? ''
  const baseUrl = validateConfiguration(
    options.apiUrl ?? process.env.ROCK_API_URL ?? '',
    apiKey,
  )
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const getRetries = options.getRetries ?? DEFAULT_GET_RETRIES
  const retryDelayMs = options.retryDelayMs ?? 100

  if (!positiveInteger(timeoutMs) || !Number.isInteger(getRetries) || getRetries < 0 || getRetries > 3 || retryDelayMs < 0) {
    throw new GivingRockClientError('configuration-invalid')
  }

  async function request({ endpoint, params, method = 'GET', body, create = false }: RequestOptions) {
    const url = new URL(endpoint, baseUrl)
    if (url.origin !== baseUrl.origin || !url.pathname.startsWith(baseUrl.pathname)) {
      throw new GivingRockClientError('configuration-invalid')
    }
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value)

    const attempts = method === 'GET' ? getRetries + 1 : 1
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          method,
          headers: {
            'Authorization-Token': apiKey,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'error',
          cache: 'no-store',
        })
        if (response.redirected) { await discardBody(response); throw new GivingRockClientError('request-rejected') }
        if (!response.ok) {
          if (create && response.status >= 500) {
            await discardBody(response)
            throw new GivingRockClientError('create-unknown', 'unknown', response.status)
          }
          if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) {
            await discardBody(response)
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)))
            continue
          }
          await discardBody(response)
          throw new GivingRockClientError(
            response.status === 429 || response.status >= 500 ? 'request-unavailable' : 'request-rejected',
            'failed',
            response.status,
          )
        }
        return await boundedJson(response, create)
      } catch (error) {
        if (error instanceof GivingRockClientError) throw error
        if (create && transient(error)) throw new GivingRockClientError('create-unknown', 'unknown')
        if (transient(error) && attempt + 1 < attempts) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)))
          continue
        }
        throw new GivingRockClientError('request-unavailable')
      }
    }
    throw new GivingRockClientError('request-unavailable')
  }

  async function findPersonByGuid(guid: string) {
    if (!validGuid(guid)) throw new GivingRockClientError('identity-invalid')
    const value = await request({
      endpoint: 'People',
      params: {
        $filter: `Guid eq guid'${guid.toLowerCase()}'`,
        $select: 'Id,PrimaryAliasId,Guid,FirstName,NickName,LastName,Email',
        $orderby: 'Id',
        $top: '2',
      },
    })
    if (!Array.isArray(value)) throw new GivingRockClientError('response-invalid')
    if (value.length === 0) return null
    if (value.length !== 1) throw new GivingRockClientError('identity-ambiguous')
    const person = requirePerson(value[0])
    if (person.guid !== guid.toLowerCase()) throw new GivingRockClientError('response-invalid')
    return person
  }

  return {
    async findActivePeopleByEmail(normalisedEmail) {
      const email = escapeODataString(normalisedEmail)
      const value = await request({
        endpoint: 'People',
        params: {
          $filter: `tolower(Email) eq '${email}' and RecordStatusValueId eq 3 and IsDeceased eq false`,
          $select: 'Id,PrimaryAliasId,Guid,FirstName,NickName,LastName,Email,RecordStatusValueId,IsDeceased',
          $orderby: 'Id',
          $top: '3',
        },
      })
      if (!Array.isArray(value)) throw new GivingRockClientError('response-invalid')
      return value
        .filter((candidate) => record(candidate) && candidate.RecordStatusValueId === 3 && candidate.IsDeceased === false)
        .map(requirePerson)
    },

    async resolveSignedInPerson(subject) {
      if (!validSubject(subject)) throw new GivingRockClientError('identity-invalid')
      const username = escapeODataString(`AUTH0_${subject}`)
      const value = await request({
        endpoint: 'UserLogins',
        params: {
          $expand: 'EntityType',
          $filter: `UserName eq '${username}'`,
          $select: 'Id,EntityTypeId,PersonId,UserName,EntityType/Id,EntityType/Guid',
          $top: '2',
        },
      })
      if (!Array.isArray(value)) throw new GivingRockClientError('response-invalid')
      if (value.length === 0) throw new GivingRockClientError('identity-not-found')
      if (value.length !== 1) throw new GivingRockClientError('identity-ambiguous')
      const login = value[0]
      if (
        !record(login) ||
        !positiveInteger(login.Id) ||
        !positiveInteger(login.PersonId) ||
        !positiveInteger(login.EntityTypeId) ||
        login.UserName !== `AUTH0_${subject}` ||
        !record(login.EntityType) ||
        login.EntityType.Id !== login.EntityTypeId ||
        typeof login.EntityType.Guid !== 'string' ||
        login.EntityType.Guid.toUpperCase() !== AUTH0_ROCK_ENTITY_TYPE_GUID
      ) {
        throw new GivingRockClientError('identity-invalid')
      }
      const person = requirePerson(await request({
        endpoint: `People/${login.PersonId}`,
        params: { $select: 'Id,PrimaryAliasId,Guid,FirstName,NickName,LastName,Email' },
      }))
      if (person.id !== login.PersonId) throw new GivingRockClientError('response-invalid')
      return person
    },

    async createPerson(input) {
      if (!validGuid(input.guid)) throw new GivingRockClientError('identity-invalid')
      const value = await request({
        endpoint: 'People',
        method: 'POST',
        body: {
          FirstName: input.firstName,
          NickName: input.firstName,
          LastName: input.lastName,
          Email: input.email,
          Guid: input.guid.toLowerCase(),
          IsSystem: false,
          Gender: 0,
        },
        create: true,
      })
      if (!positiveInteger(value)) throw new GivingRockClientError('create-unknown', 'unknown')
      try {
        const created = requirePerson(await request({
          endpoint: `People/${value}`,
          params: { $select: 'Id,PrimaryAliasId,Guid,FirstName,NickName,LastName,Email' },
        }))
        if (created.id !== value) throw new GivingRockClientError('create-unknown', 'unknown')
        return created
      } catch {
        throw new GivingRockClientError('create-unknown', 'unknown')
      }
    },

    findPersonByGuid,

    async getPersonByAlias(personAliasId) {
      if (!positiveInteger(personAliasId)) throw new GivingRockClientError('identity-invalid')
      return requirePerson(await request({
        endpoint: `People/GetByPersonAliasId/${personAliasId}`,
        params: { $select: 'Id,PrimaryAliasId,Guid,FirstName,NickName,LastName,Email' },
      }))
    },
  }
}
