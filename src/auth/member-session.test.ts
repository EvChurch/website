import { describe, expect, it, vi } from 'vitest'

import type { SessionData } from '@auth0/nextjs-auth0/types'

const state = vi.hoisted(() => ({
  currentSession: null as unknown,
  sessionReadFails: false,
}))

vi.mock('./auth0-client', () => ({
  getAuth0Client: () => ({
    getSession: vi.fn(async () => {
      if (state.sessionReadFails) throw new Error('Invalid encrypted cookie')
      return state.currentSession
    }),
  }),
}))

import {
  createResolvedMemberMarker,
  createUnresolvedMemberMarker,
  getCurrentMemberProfile,
  getMemberProfileFromSession,
} from './member-session'

function session(rockProfile?: unknown): SessionData {
  return {
    user: { sub: 'auth0|member-42' },
    tokenSet: { accessToken: 'token', expiresAt: 1 },
    internal: { sid: 'sid', createdAt: 1 },
    ...(rockProfile === undefined ? {} : { rockProfile }),
  }
}

describe('member session marker', () => {
  it('returns the minimal profile from a valid resolved marker', () => {
    const marker = createResolvedMemberMarker({
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: null,
    })

    expect(getMemberProfileFromSession(session(marker))).toEqual({
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: null,
    })
  })

  it.each([
    ['Auth0-only', undefined],
    ['unresolved', createUnresolvedMemberMarker()],
    ['wrong version', { version: 2, status: 'resolved', profile: {} }],
    [
      'missing email',
      {
        version: 1,
        status: 'resolved',
        profile: { personId: 42, name: 'Alex', photoUrl: null },
      },
    ],
    [
      'malformed person ID',
      {
        version: 1,
        status: 'resolved',
        profile: {
          personId: '42',
          name: 'Alex',
          email: 'alex@example.com',
          photoUrl: null,
        },
      },
    ],
  ])('rejects %s session state', (_label, marker) => {
    expect(getMemberProfileFromSession(session(marker))).toBeNull()
  })

  it('does not expose or log malformed marker contents', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const secretValue = 'person@example.com'

    expect(
      getMemberProfileFromSession(
        session({ version: 1, status: 'resolved', profile: secretValue }),
      ),
    ).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it('fails closed when the SDK rejects a tampered session cookie', async () => {
    state.sessionReadFails = true

    await expect(getCurrentMemberProfile()).resolves.toBeNull()
  })
})
