import { describe, expect, it } from 'vitest'
import type { SessionData } from '@auth0/nextjs-auth0/types'

import {
  getMemberImpersonationFromSession,
  startMemberImpersonation,
  stopMemberImpersonation,
} from './member-impersonation'
import {
  createResolvedMemberMarker,
  createUnresolvedMemberMarker,
  getMemberProfileFromSession,
} from './member-session'

const target = {
  personId: 42,
  name: 'Alex Member',
  email: 'alex@example.com',
  photoUrl: null,
  campusSlug: 'central',
}

function session(rockProfile?: unknown): SessionData {
  return {
    user: { sub: 'auth0|admin-1', name: 'Real Admin' },
    tokenSet: { accessToken: 'token', expiresAt: 1 },
    internal: { sid: 'sid', createdAt: 1 },
    ...(rockProfile === undefined ? {} : { rockProfile }),
  }
}

describe('member impersonation session state', () => {
  it('overlays the target profile without changing the Auth0 user', () => {
    const original = session(createUnresolvedMemberMarker())
    const updated = startMemberImpersonation(original, target)

    expect(updated?.user).toEqual(original.user)
    expect(getMemberProfileFromSession(updated)).toEqual(target)
    expect(getMemberImpersonationFromSession(updated)).toEqual({
      name: target.name,
      email: target.email,
      personId: target.personId,
    })
  })

  it.each([
    ['absent', undefined],
    ['unresolved', createUnresolvedMemberMarker()],
    [
      'resolved',
      createResolvedMemberMarker({
        personId: 7,
        name: 'Real Admin',
        email: 'admin@example.com',
        photoUrl: null,
      }),
    ],
    [
      'legacy',
      {
        version: 2,
        status: 'resolved',
        profile: {
          personId: 7,
          name: 'Real Admin',
          email: 'admin@example.com',
          photoUrl: null,
          campusSlug: null,
        },
      },
    ],
  ])('restores an %s original member state', (_label, originalMarker) => {
    const original = session(originalMarker)
    const impersonated = startMemberImpersonation(original, target)!
    const restored = stopMemberImpersonation(impersonated)!

    expect(restored.user).toEqual(original.user)
    expect(getMemberImpersonationFromSession(restored)).toBeNull()
    expect(getMemberProfileFromSession(restored)).toEqual(
      originalMarker && 'profile' in originalMarker
        ? originalMarker.profile
        : getMemberProfileFromSession(original),
    )
    if (originalMarker === undefined) expect('rockProfile' in restored).toBe(false)
  })

  it('rejects nested impersonation and malformed markers', () => {
    const impersonated = startMemberImpersonation(session(), target)!
    expect(startMemberImpersonation(impersonated, target)).toBeNull()

    const malformed = { ...session(), memberImpersonation: { version: 1 } }
    expect(getMemberImpersonationFromSession(malformed)).toBeNull()
    expect(stopMemberImpersonation(malformed)).toBeNull()
  })

  it('rejects a target profile that cannot pass the member marker validator', () => {
    expect(
      startMemberImpersonation(session(), { ...target, personId: -1 }),
    ).toBeNull()
  })
})
