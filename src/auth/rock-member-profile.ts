import {
  MemberRockAPIError,
  memberRockFetch,
  type MemberRockRequestOptions,
} from './member-rock-client'

export const AUTH0_ROCK_ENTITY_TYPE_GUID =
  '9D2EDAC7-1051-40A1-BE28-32C0ABD1B28F'

const MAX_AUTH0_SUBJECT_LENGTH = 249
const ROCK_REQUEST_TIMEOUT_MS = 3_000
const ROCK_REQUEST_RETRIES = 1
const FAILURE_LOG_MESSAGE = 'Member Rock profile resolution failed'

interface RockAuthenticationEntityResponse {
  Id: number
  Guid: string
}

interface RockUserLoginResponse {
  Id: number
  EntityTypeId: number | null
  ForeignKey: string | null
  PersonId: number | null
  UserName: string | null
  EntityType: RockAuthenticationEntityResponse | null
}

interface RockPersonResponse {
  Id: number
  FullName?: string | null
  FirstName?: string | null
  NickName?: string | null
  LastName?: string | null
  Email?: string | null
  PhotoUrl?: string | null
}

export interface RockMemberProfile {
  personId: number
  name: string
  email: string
  photoUrl: string | null
}

export type RockMemberProfileFailureReason =
  | 'invalid-subject'
  | 'identity-not-found'
  | 'identity-ambiguous'
  | 'identity-invalid'
  | 'profile-invalid'
  | 'malformed-response'
  | 'upstream-rejected'
  | 'upstream-unavailable'

export type RockMemberProfileResolution =
  | { ok: true; profile: RockMemberProfile }
  | { ok: false; reason: RockMemberProfileFailureReason }

type RockRequestResult =
  | { ok: true; value: unknown }
  | {
      ok: false
      reason: Extract<
        RockMemberProfileFailureReason,
        'malformed-response' | 'upstream-rejected' | 'upstream-unavailable'
      >
      status?: number
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value > 0
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/u.test(value)
}

function isValidSubject(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_AUTH0_SUBJECT_LENGTH &&
    !hasControlCharacters(value)
  )
}

function escapeODataStringLiteral(value: string) {
  return value.replaceAll("'", "''")
}

function isTransientError(error: unknown) {
  if (error instanceof MemberRockAPIError) {
    return error.status === 429 || error.status >= 500
  }

  return (
    error instanceof TypeError ||
    (error instanceof DOMException &&
      (error.name === 'AbortError' || error.name === 'TimeoutError'))
  )
}

function classifyRequestError(error: unknown): RockRequestResult {
  if (error instanceof MemberRockAPIError) {
    return error.status === 429 || error.status >= 500
      ? { ok: false, reason: 'upstream-unavailable', status: error.status }
      : { ok: false, reason: 'upstream-rejected', status: error.status }
  }

  if (error instanceof SyntaxError) {
    return { ok: false, reason: 'malformed-response' }
  }

  return { ok: false, reason: 'upstream-unavailable' }
}

async function requestRock(
  options: MemberRockRequestOptions,
): Promise<RockRequestResult> {
  for (let attempt = 0; attempt <= ROCK_REQUEST_RETRIES; attempt += 1) {
    try {
      return {
        ok: true,
        value: await memberRockFetch<unknown>({
          ...options,
          retries: 0,
          timeoutMs: ROCK_REQUEST_TIMEOUT_MS,
        }),
      }
    } catch (error) {
      if (!isTransientError(error) || attempt === ROCK_REQUEST_RETRIES) {
        return classifyRequestError(error)
      }
    }
  }

  return { ok: false, reason: 'upstream-unavailable' }
}

function fail(
  reason: RockMemberProfileFailureReason,
  status?: number,
): RockMemberProfileResolution {
  console.warn(FAILURE_LOG_MESSAGE, {
    reason,
    ...(status === undefined ? {} : { status }),
  })
  return { ok: false, reason }
}

function parseLogin(value: unknown): RockUserLoginResponse | null {
  if (!isRecord(value)) return null

  const entityType = value.EntityType
  if (!isRecord(entityType)) return null

  return {
    Id: typeof value.Id === 'number' ? value.Id : Number.NaN,
    EntityTypeId:
      typeof value.EntityTypeId === 'number' ? value.EntityTypeId : null,
    ForeignKey: typeof value.ForeignKey === 'string' ? value.ForeignKey : null,
    PersonId: typeof value.PersonId === 'number' ? value.PersonId : null,
    UserName: typeof value.UserName === 'string' ? value.UserName : null,
    EntityType: {
      Id: typeof entityType.Id === 'number' ? entityType.Id : Number.NaN,
      Guid: typeof entityType.Guid === 'string' ? entityType.Guid : '',
    },
  }
}

function hasExpectedIdentity(
  login: RockUserLoginResponse,
  subject: string,
): login is RockUserLoginResponse & { PersonId: number } {
  return (
    isPositiveInteger(login.Id) &&
    isPositiveInteger(login.PersonId) &&
    isPositiveInteger(login.EntityTypeId) &&
    isPositiveInteger(login.EntityType?.Id) &&
    login.EntityTypeId === login.EntityType.Id &&
    login.EntityType.Guid.toUpperCase() === AUTH0_ROCK_ENTITY_TYPE_GUID &&
    login.ForeignKey === subject &&
    login.UserName === `AUTH0_${subject}`
  )
}

function optionalTextIsValid(value: unknown) {
  return value === undefined || value === null || typeof value === 'string'
}

function parsePerson(value: unknown, personId: number): RockPersonResponse | null {
  if (!isRecord(value) || value.Id !== personId) return null
  if (
    !optionalTextIsValid(value.FullName) ||
    !optionalTextIsValid(value.FirstName) ||
    !optionalTextIsValid(value.NickName) ||
    !optionalTextIsValid(value.LastName) ||
    !optionalTextIsValid(value.Email) ||
    !optionalTextIsValid(value.PhotoUrl)
  ) {
    return null
  }

  return {
    Id: personId,
    FullName: value.FullName as string | null | undefined,
    FirstName: value.FirstName as string | null | undefined,
    NickName: value.NickName as string | null | undefined,
    LastName: value.LastName as string | null | undefined,
    Email: value.Email as string | null | undefined,
    PhotoUrl: value.PhotoUrl as string | null | undefined,
  }
}

function toProfile(person: RockPersonResponse): RockMemberProfile | null {
  const personId = person.Id

  const fullName =
    typeof person.FullName === 'string' ? person.FullName.trim() : ''
  const familiarName =
    typeof person.NickName === 'string' && person.NickName.trim()
      ? person.NickName.trim()
      : typeof person.FirstName === 'string'
        ? person.FirstName.trim()
        : ''
  const lastName =
    typeof person.LastName === 'string' ? person.LastName.trim() : ''
  const name = fullName || [familiarName, lastName].filter(Boolean).join(' ')
  const email = typeof person.Email === 'string' ? person.Email.trim() : ''

  if (
    !name ||
    !email ||
    hasControlCharacters(name) ||
    hasControlCharacters(email)
  ) {
    return null
  }

  const photoUrl =
    typeof person.PhotoUrl === 'string' && person.PhotoUrl.trim()
      ? person.PhotoUrl.trim()
      : null

  return { personId, name, email, photoUrl }
}

export async function resolveRockMemberProfile(
  subject: unknown,
): Promise<RockMemberProfileResolution> {
  if (!isValidSubject(subject)) return fail('invalid-subject')

  const escapedSubject = escapeODataStringLiteral(subject)
  const escapedUserName = escapeODataStringLiteral(`AUTH0_${subject}`)
  const loginResponse = await requestRock({
    endpoint: 'UserLogins',
    params: {
      $expand: 'EntityType',
      $filter: `ForeignKey eq '${escapedSubject}' and UserName eq '${escapedUserName}'`,
      $select:
        'Id,EntityTypeId,ForeignKey,PersonId,UserName,EntityType/Id,EntityType/Guid',
      $top: '2',
    },
  })

  if (!loginResponse.ok) {
    return fail(loginResponse.reason, loginResponse.status)
  }
  if (!Array.isArray(loginResponse.value)) return fail('malformed-response')
  if (loginResponse.value.length === 0) return fail('identity-not-found')
  if (loginResponse.value.length !== 1) return fail('identity-ambiguous')

  const login = parseLogin(loginResponse.value[0])
  if (!login) return fail('malformed-response')
  if (!hasExpectedIdentity(login, subject)) return fail('identity-invalid')

  const personResponse = await requestRock({
    endpoint: `People/${login.PersonId}`,
    params: {
      $select: 'Id,FullName,FirstName,NickName,LastName,Email,PhotoUrl',
    },
  })
  if (!personResponse.ok) {
    return fail(personResponse.reason, personResponse.status)
  }

  const person = parsePerson(personResponse.value, login.PersonId)
  const profile = person ? toProfile(person) : null
  return profile ? { ok: true, profile } : fail('profile-invalid')
}
