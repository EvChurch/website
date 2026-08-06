import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  memberRockFetch: vi.fn(),
}))

vi.mock('./member-rock-client', async () => {
  const actual = await vi.importActual<typeof import('./member-rock-client')>(
    './member-rock-client',
  )

  return {
    ...actual,
    memberRockFetch: mocks.memberRockFetch,
  }
})

import { MemberRockAPIError } from './member-rock-client'
import {
  AUTH0_ROCK_ENTITY_TYPE_GUID,
  resolveRockMemberProfile,
} from './rock-member-profile'

const subject = 'auth0|member-123'
const login = {
  Id: 7,
  EntityTypeId: 19,
  ForeignKey: subject,
  PersonId: 42,
  UserName: `AUTH0_${subject}`,
  EntityType: {
    Id: 19,
    Guid: AUTH0_ROCK_ENTITY_TYPE_GUID,
  },
}
const person = {
  Id: 42,
  FullName: 'Ada Lovelace',
  FirstName: 'Augusta',
  NickName: 'Ada',
  LastName: 'Lovelace',
  Email: 'ada@example.com',
  PhotoId: 42,
}

describe('resolveRockMemberProfile', () => {
  beforeEach(() => {
    mocks.memberRockFetch.mockReset()
    vi.restoreAllMocks()
  })

  it('resolves exactly one Auth0 login to a minimal linked-person DTO', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce([login])
      .mockResolvedValueOnce(person)

    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: true,
      profile: {
        personId: 42,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        photoUrl: '/GetAvatar.ashx?PhotoId=42&Size=400',
      },
    })
    expect(mocks.memberRockFetch).toHaveBeenNthCalledWith(1, {
      endpoint: 'UserLogins',
      params: {
        $expand: 'EntityType',
        $filter:
          "ForeignKey eq 'auth0|member-123' and UserName eq 'AUTH0_auth0|member-123'",
        $select:
          'Id,EntityTypeId,ForeignKey,PersonId,UserName,EntityType/Id,EntityType/Guid',
        $top: '2',
      },
      timeoutMs: 3_000,
    })
    expect(mocks.memberRockFetch).toHaveBeenNthCalledWith(2, {
      endpoint: 'People/42',
      params: {
        $select:
          'Id,FullName,FirstName,NickName,LastName,Email,PhotoId',
      },
      timeoutMs: 3_000,
    })
  })

  it('uses only the subject even when the linked person email changes', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce([login])
      .mockResolvedValueOnce({ ...person, Email: 'new-address@example.com' })

    const result = await resolveRockMemberProfile(subject)

    expect(result).toMatchObject({
      ok: true,
      profile: { email: 'new-address@example.com' },
    })
    expect(mocks.memberRockFetch.mock.calls[0]?.[0].params.$filter).not.toContain(
      'example.com',
    )
  })

  it('uses the Rock name fields and a null photo fallback when no photo is usable', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce([login])
      .mockResolvedValueOnce({
        ...person,
        FullName: null,
        PhotoId: null,
      })

    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: true,
      profile: {
        personId: 42,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        photoUrl: null,
      },
    })
  })

  it('uses the local initials fallback when Rock has no profile photo', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce([login])
      .mockResolvedValueOnce({
        ...person,
        PhotoId: null,
        PhotoUrl:
          '/GetAvatar.ashx?AgeClassification=Adult&Gender=Female&RecordTypeId=1&Text=AL',
      })

    await expect(resolveRockMemberProfile(subject)).resolves.toMatchObject({
      ok: true,
      profile: { photoUrl: null },
    })
  })

  it('uses the local initials fallback when Rock omits PhotoId', async () => {
    mocks.memberRockFetch
      .mockResolvedValueOnce([login])
      .mockResolvedValueOnce({ ...person, PhotoId: undefined })

    await expect(resolveRockMemberProfile(subject)).resolves.toMatchObject({
      ok: true,
      profile: { photoUrl: null },
    })
  })

  it.each([
    ['empty', ''],
    ['oversized', 'x'.repeat(250)],
    ['control-character', 'auth0|line\nbreak'],
  ])('rejects an %s subject before contacting Rock', async (_label, candidate) => {
    await expect(resolveRockMemberProfile(candidate)).resolves.toEqual({
      ok: false,
      reason: 'invalid-subject',
    })
    expect(mocks.memberRockFetch).not.toHaveBeenCalled()
  })

  it('escapes quotes in both OData string literals without broadening the filter', async () => {
    const quotedSubject = "auth0|o'hara' or PersonId ne null"
    mocks.memberRockFetch.mockResolvedValueOnce([])

    await resolveRockMemberProfile(quotedSubject)

    expect(mocks.memberRockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          $filter:
            "ForeignKey eq 'auth0|o''hara'' or PersonId ne null' and UserName eq 'AUTH0_auth0|o''hara'' or PersonId ne null'",
          $top: '2',
        }),
      }),
    )
  })

  it('fails closed for zero or duplicate identities without retrying', async () => {
    mocks.memberRockFetch.mockResolvedValueOnce([])
    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: false,
      reason: 'identity-not-found',
    })
    expect(mocks.memberRockFetch).toHaveBeenCalledTimes(1)

    mocks.memberRockFetch
      .mockReset()
      .mockResolvedValueOnce([login, { ...login, Id: 8 }])
    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: false,
      reason: 'identity-ambiguous',
    })
    expect(mocks.memberRockFetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'case-mismatched foreign key',
      { ...login, ForeignKey: 'AUTH0|MEMBER-123' },
    ],
    ['wrong username', { ...login, UserName: `auth0_${subject}` }],
    [
      'wrong authentication entity',
      {
        ...login,
        EntityType: {
          ...login.EntityType,
          Guid: 'f14c5a2e-16a4-4c32-8f7c-19bf335410bc',
        },
      },
    ],
    ['mismatched authentication entity id', { ...login, EntityTypeId: 20 }],
    ['missing person', { ...login, PersonId: null }],
  ])('rejects a %s login response', async (_label, invalidLogin) => {
    mocks.memberRockFetch.mockResolvedValueOnce([invalidLogin])

    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: false,
      reason: 'identity-invalid',
    })
    expect(mocks.memberRockFetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'missing name',
      { ...person, FullName: '', FirstName: '', NickName: '', LastName: '' },
    ],
    ['missing email', { ...person, Email: '   ' }],
    ['wrong person', { ...person, Id: 99 }],
    ['zero photo id', { ...person, PhotoId: 0 }],
    ['negative photo id', { ...person, PhotoId: -1 }],
    ['fractional photo id', { ...person, PhotoId: 1.5 }],
    ['string photo id', { ...person, PhotoId: '42' }],
  ])('rejects a person response with %s', async (_label, invalidPerson) => {
    mocks.memberRockFetch
      .mockResolvedValueOnce([login])
      .mockResolvedValueOnce(invalidPerson)

    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: false,
      reason: 'profile-invalid',
    })
  })

  it.each([null, {}, [null], { unexpected: true }])(
    'rejects malformed identity response %#',
    async (response) => {
      mocks.memberRockFetch.mockResolvedValueOnce(response)

      await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
        ok: false,
        reason: 'malformed-response',
      })
    },
  )

  it.each([401, 403, 404])(
    'does not retry a non-transient Rock %i response',
    async (status) => {
      mocks.memberRockFetch.mockRejectedValueOnce(new MemberRockAPIError(status))

      await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
        ok: false,
        reason: 'upstream-rejected',
      })
      expect(mocks.memberRockFetch).toHaveBeenCalledTimes(1)
    },
  )

  it.each([429, 500, 503])(
    'retries a transient Rock %i response at most once',
    async (status) => {
      mocks.memberRockFetch
        .mockRejectedValueOnce(new MemberRockAPIError(status))
        .mockResolvedValueOnce([])

      await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
        ok: false,
        reason: 'identity-not-found',
      })
      expect(mocks.memberRockFetch).toHaveBeenCalledTimes(2)
    },
  )

  it('retries a timeout once and rejects malformed JSON without retrying', async () => {
    mocks.memberRockFetch
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce([])

    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: false,
      reason: 'identity-not-found',
    })
    expect(mocks.memberRockFetch).toHaveBeenCalledTimes(2)

    mocks.memberRockFetch
      .mockReset()
      .mockRejectedValueOnce(new SyntaxError('bad json'))
    await expect(resolveRockMemberProfile(subject)).resolves.toEqual({
      ok: false,
      reason: 'malformed-response',
    })
    expect(mocks.memberRockFetch).toHaveBeenCalledTimes(1)
  })

  it('logs only reason categories and upstream status', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const secretSubject = 'auth0|do-not-log-me'
    mocks.memberRockFetch.mockRejectedValueOnce(new MemberRockAPIError(403))

    await resolveRockMemberProfile(secretSubject)

    expect(warning).toHaveBeenCalledWith('Member Rock profile resolution failed', {
      reason: 'upstream-rejected',
      status: 403,
    })
    const output = JSON.stringify(warning.mock.calls)
    expect(output).not.toContain(secretSubject)
    expect(output).not.toContain('ada@example.com')
    expect(output).not.toContain('member-rock-key')
  })
})
