import {
  MemberRockAPIError,
  memberRockFetch,
} from './member-rock-client'
import {
  auth0LoginPersonId,
  memberProfileFromRockPerson,
  type RockMemberProfile,
} from './rock-member-profile'

const SEARCH_TIMEOUT_MS = 3_000
const MAX_EMAIL_LENGTH = 254
const MIN_EMAIL_SEARCH_LENGTH = 3
const MAX_SEARCH_RESULTS = 20
const controlCharacters = /[\u0000-\u001f\u007f]/u

export type RockMemberDirectoryFailureReason =
  | 'invalid-query'
  | 'invalid-person'
  | 'identity-not-found'
  | 'profile-invalid'
  | 'malformed-response'
  | 'upstream-rejected'
  | 'upstream-unavailable'

export type RockMemberDirectorySearchResult =
  | { ok: true; members: RockMemberProfile[] }
  | { ok: false; reason: RockMemberDirectoryFailureReason }

export type RockMemberDirectoryProfileResult =
  | { ok: true; profile: RockMemberProfile }
  | { ok: false; reason: RockMemberDirectoryFailureReason }

function escapeODataStringLiteral(value: string) {
  return value.replaceAll("'", "''")
}

function validEmailQuery(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= MIN_EMAIL_SEARCH_LENGTH &&
    value.length <= MAX_EMAIL_LENGTH &&
    value.trim() === value &&
    !controlCharacters.test(value)
  )
}

function requestFailure(error: unknown): RockMemberDirectoryFailureReason {
  if (error instanceof MemberRockAPIError) {
    return error.status === 429 || error.status >= 500
      ? 'upstream-unavailable'
      : 'upstream-rejected'
  }
  return error instanceof SyntaxError
    ? 'malformed-response'
    : 'upstream-unavailable'
}

async function peopleByEmail(query: string) {
  const normalizedQuery = escapeODataStringLiteral(query.toLowerCase())
  return memberRockFetch<unknown>({
    endpoint: 'People',
    params: {
      $filter: `indexof(tolower(Email),'${normalizedQuery}') ge 0`,
      $orderby: 'Email',
      $select:
        'Id,FirstName,NickName,LastName,Email,PhotoId,PrimaryCampusId',
      $top: String(MAX_SEARCH_RESULTS),
    },
    timeoutMs: SEARCH_TIMEOUT_MS,
  })
}

async function auth0LoginsForPersonIds(personIds: number[]) {
  return memberRockFetch<unknown>({
    endpoint: 'UserLogins',
    params: {
      $expand: 'EntityType',
      $filter: personIds.map((personId) => `PersonId eq ${personId}`).join(' or '),
      $select:
        'Id,EntityTypeId,PersonId,UserName,EntityType/Id,EntityType/Guid',
      $top: String(MAX_SEARCH_RESULTS * 2),
    },
    timeoutMs: SEARCH_TIMEOUT_MS,
  })
}

export async function searchRockAuth0MembersByEmail(
  query: unknown,
): Promise<RockMemberDirectorySearchResult> {
  if (!validEmailQuery(query)) return { ok: false, reason: 'invalid-query' }

  try {
    const rawPeople = await peopleByEmail(query)
    if (!Array.isArray(rawPeople)) {
      return { ok: false, reason: 'malformed-response' }
    }

    const profiles = rawPeople
      .slice(0, MAX_SEARCH_RESULTS)
      .map((value) => {
        if (typeof value !== 'object' || value === null) return null
        const personId = Reflect.get(value, 'Id')
        return Number.isInteger(personId) && personId > 0
          ? memberProfileFromRockPerson(value, personId)
          : null
      })
      .filter((profile): profile is RockMemberProfile => profile !== null)

    if (profiles.length === 0) return { ok: true, members: [] }

    const rawLogins = await auth0LoginsForPersonIds(
      profiles.map(({ personId }) => personId),
    )
    if (!Array.isArray(rawLogins)) {
      return { ok: false, reason: 'malformed-response' }
    }

    const linkedPersonIds = new Set(
      rawLogins
        .map(auth0LoginPersonId)
        .filter((personId): personId is number => personId !== null),
    )

    return {
      ok: true,
      members: profiles.filter(({ personId }) => linkedPersonIds.has(personId)),
    }
  } catch (error) {
    return { ok: false, reason: requestFailure(error) }
  }
}

export async function findRockAuth0MemberByPersonId(
  candidate: unknown,
): Promise<RockMemberDirectoryProfileResult> {
  if (!Number.isInteger(candidate) || typeof candidate !== 'number' || candidate <= 0) {
    return { ok: false, reason: 'invalid-person' }
  }

  try {
    const [rawPerson, rawLogins] = await Promise.all([
      memberRockFetch<unknown>({
        endpoint: `People/${candidate}`,
        params: {
          $select:
            'Id,FullName,FirstName,NickName,LastName,Email,PhotoId,PrimaryCampusId',
        },
        timeoutMs: SEARCH_TIMEOUT_MS,
      }),
      auth0LoginsForPersonIds([candidate]),
    ])

    const profile = memberProfileFromRockPerson(rawPerson, candidate)
    if (!profile) return { ok: false, reason: 'profile-invalid' }
    if (!Array.isArray(rawLogins)) {
      return { ok: false, reason: 'malformed-response' }
    }
    if (!rawLogins.some((login) => auth0LoginPersonId(login) === candidate)) {
      return { ok: false, reason: 'identity-not-found' }
    }

    return { ok: true, profile }
  } catch (error) {
    return { ok: false, reason: requestFailure(error) }
  }
}
