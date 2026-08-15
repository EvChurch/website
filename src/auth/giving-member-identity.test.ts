import type { SessionData } from '@auth0/nextjs-auth0/types'
import { describe, expect, it, vi } from 'vitest'

import {
  givingIdentityForMemberSubmission,
  resolveCurrentGivingMemberIdentity,
} from './giving-member-identity'

describe('giving member identity', () => {
  it('uses only the server session subject and accepts a partial fresh Rock identity', async () => {
    const resolveSignedInPerson = vi.fn().mockResolvedValue({
      id: 42, primaryAliasId: 84, guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d', firstName: 'Ada', lastName: null, email: null,
    })
    const session = { user: { sub: 'auth0|member', email: 'untrusted@example.com' }, rockProfile: { profile: { personId: 999 } } } as unknown as SessionData

    await expect(resolveCurrentGivingMemberIdentity({
      getSession: vi.fn().mockResolvedValue(session),
      rockClient: { resolveSignedInPerson } as never,
    })).resolves.toEqual({
      signedIn: true,
      personId: 42,
      personAliasId: 84,
      firstName: 'Ada',
      lastName: null,
      email: null,
      missingFields: ['lastName', 'email'],
    })
    expect(resolveSignedInPerson).toHaveBeenCalledWith('auth0|member')
  })

  it('returns signed-out without calling Rock when the server session has no usable subject', async () => {
    const resolveSignedInPerson = vi.fn()
    await expect(resolveCurrentGivingMemberIdentity({
      getSession: vi.fn().mockResolvedValue(null),
      rockClient: { resolveSignedInPerson } as never,
    })).resolves.toEqual({ signedIn: false })
    expect(resolveSignedInPerson).not.toHaveBeenCalled()
  })

  it('keeps the server alias and known fields when browser input tries to replace them', () => {
    const alteredInput = {
      firstName: 'Browser',
      lastName: 'Lovelace',
      email: 'altered@example.com',
      personAliasId: 999,
      bankReference: 'EV999',
    }
    expect(givingIdentityForMemberSubmission({
      signedIn: true,
      personId: 42,
      personAliasId: 84,
      firstName: 'Ada',
      lastName: null,
      email: 'ada@example.com',
      missingFields: ['lastName'],
    }, alteredInput)).toEqual({
      kind: 'member',
      personAliasId: 84,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    })
  })
})
