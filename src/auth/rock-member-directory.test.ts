import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ memberRockFetch: vi.fn() }))

vi.mock('./member-rock-client', async () => {
  const actual = await vi.importActual<typeof import('./member-rock-client')>(
    './member-rock-client',
  )
  return { ...actual, memberRockFetch: mocks.memberRockFetch }
})

import { MemberRockAPIError } from './member-rock-client'
import {
  findRockAuth0MemberByPersonId,
  searchRockAuth0MembersByEmail,
} from './rock-member-directory'
import { AUTH0_ROCK_ENTITY_TYPE_GUID } from './rock-member-profile'

const people = [
  {
    Id: 42,
    FullName: 'Ada Lovelace',
    Email: 'ada@example.com',
    PhotoId: 5,
    PrimaryCampusId: 3,
  },
  {
    Id: 43,
    FullName: 'Grace Hopper',
    Email: 'grace@example.com',
    PhotoId: null,
    PrimaryCampusId: 2,
  },
]

const twentyPeople = Array.from({ length: 20 }, (_, index) => ({
  Id: index + 1,
  FirstName: `Person ${index + 1}`,
  Email: `person${index + 1}@example.com`,
}))

const auth0Login = (personId: number, overrides: Record<string, unknown> = {}) => ({
  Id: personId + 100,
  EntityTypeId: 19,
  PersonId: personId,
  UserName: `AUTH0_auth0|member-${personId}`,
  EntityType: { Id: 19, Guid: AUTH0_ROCK_ENTITY_TYPE_GUID },
  ...overrides,
})

describe('Rock Auth0 member directory', () => {
  beforeEach(() => mocks.memberRockFetch.mockReset())

  it('returns only people with a valid Auth0-linked login', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce(people)
      .mockResolvedValueOnce([
        auth0Login(42),
        auth0Login(43, { EntityType: { Id: 19, Guid: 'wrong-guid' } }),
      ])

    await expect(searchRockAuth0MembersByEmail('ADA@example')).resolves.toEqual({
      ok: true,
      members: [
        {
          personId: 42,
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          photoUrl: '/GetAvatar.ashx?PhotoId=5&Size=400',
          campusSlug: 'central',
        },
      ],
    })

    expect(mocks.memberRockFetch).toHaveBeenNthCalledWith(1, {
      endpoint: 'People',
      params: {
        $filter: "indexof(tolower(Email),'ada@example') ge 0",
        $orderby: 'Email',
        $select:
          'Id,FirstName,NickName,LastName,Email,PhotoId,PrimaryCampusId',
        $top: '20',
      },
      timeoutMs: 3_000,
    })
    expect(mocks.memberRockFetch.mock.calls[1]?.[0].params.$filter).toBe(
      'PersonId eq 42 or PersonId eq 43',
    )
  })

  it('batches Auth0 login lookups when an email search returns 20 people', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce(twentyPeople)
      .mockResolvedValueOnce([auth0Login(1)])
      .mockResolvedValueOnce([auth0Login(20)])

    await expect(searchRockAuth0MembersByEmail('person')).resolves.toEqual({
      ok: true,
      members: [
        expect.objectContaining({ personId: 1 }),
        expect.objectContaining({ personId: 20 }),
      ],
    })

    expect(mocks.memberRockFetch).toHaveBeenCalledTimes(3)
    expect(mocks.memberRockFetch.mock.calls[1]?.[0].params.$filter).toBe(
      Array.from({ length: 16 }, (_, index) => `PersonId eq ${index + 1}`).join(
        ' or ',
      ),
    )
    expect(mocks.memberRockFetch.mock.calls[2]?.[0].params.$filter).toBe(
      'PersonId eq 17 or PersonId eq 18 or PersonId eq 19 or PersonId eq 20',
    )
  })

  it('fails closed when a later Auth0 login batch fails', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce(twentyPeople)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ docs: [] })

    await expect(searchRockAuth0MembersByEmail('person')).resolves.toEqual({
      ok: false,
      reason: 'malformed-response',
    })

    mocks.memberRockFetch.mockReset()
    mocks.memberRockFetch
      .mockResolvedValueOnce(twentyPeople)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new MemberRockAPIError(503))

    await expect(searchRockAuth0MembersByEmail('person')).resolves.toEqual({
      ok: false,
      reason: 'upstream-unavailable',
    })
  })

  it('escapes email search text and rejects broad or malformed queries', async () => {
    mocks.memberRockFetch.mockResolvedValueOnce([])

    await searchRockAuth0MembersByEmail("o'hara@example.com")
    expect(mocks.memberRockFetch.mock.calls[0]?.[0].params.$filter).toBe(
      "indexof(tolower(Email),'o''hara@example.com') ge 0",
    )

    for (const value of ['', 'ab', 'x'.repeat(255), 'a\nb@example.com']) {
      await expect(searchRockAuth0MembersByEmail(value)).resolves.toEqual({
        ok: false,
        reason: 'invalid-query',
      })
    }
    expect(mocks.memberRockFetch).toHaveBeenCalledTimes(1)
  })

  it('revalidates a selected person before impersonation', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce(people[0])
      .mockResolvedValueOnce([auth0Login(42)])

    await expect(findRockAuth0MemberByPersonId(42)).resolves.toEqual({
      ok: true,
      profile: expect.objectContaining({ personId: 42, email: 'ada@example.com' }),
    })
  })

  it('fails closed for invalid selections, missing links, and upstream errors', async () => {
    await expect(findRockAuth0MemberByPersonId('42')).resolves.toEqual({
      ok: false,
      reason: 'invalid-person',
    })

    mocks.memberRockFetch
      .mockResolvedValueOnce(people[0])
      .mockResolvedValueOnce([])
    await expect(findRockAuth0MemberByPersonId(42)).resolves.toEqual({
      ok: false,
      reason: 'identity-not-found',
    })

    mocks.memberRockFetch.mockRejectedValueOnce(new MemberRockAPIError(403))
    await expect(searchRockAuth0MembersByEmail('ada@example.com')).resolves.toEqual({
      ok: false,
      reason: 'upstream-rejected',
    })
  })

  it('treats malformed responses and transient failures as private failures', async () => {
    mocks.memberRockFetch.mockResolvedValueOnce({ docs: people })
    await expect(searchRockAuth0MembersByEmail('ada@example.com')).resolves.toEqual({
      ok: false,
      reason: 'malformed-response',
    })

    mocks.memberRockFetch.mockRejectedValueOnce(new TypeError('network'))
    await expect(searchRockAuth0MembersByEmail('ada@example.com')).resolves.toEqual({
      ok: false,
      reason: 'upstream-unavailable',
    })
  })
})
