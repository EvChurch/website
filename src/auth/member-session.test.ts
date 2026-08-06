import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionData } from '@auth0/nextjs-auth0/types'

const state = vi.hoisted(() => ({
  currentSession: null as unknown,
  sessionReadFails: false,
  sessionUpdateFails: false,
  resolutionCalls: 0,
  updatedSession: null as unknown,
  resolvedProfile: null as null | {
    personId: number
    name: string
    email: string
    photoUrl: string | null
  },
}))

vi.mock('./auth0-client', () => ({
  getAuth0Client: () => ({
    getSession: vi.fn(async () => {
      if (state.sessionReadFails) throw new Error('Invalid encrypted cookie')
      return state.currentSession
    }),
    updateSession: vi.fn(async (updatedSession) => {
      if (state.sessionUpdateFails) throw new Error('Cookie write failed')
      state.updatedSession = updatedSession
    }),
  }),
}))

vi.mock('./rock-member-profile', () => ({
  resolveRockMemberProfile: vi.fn(async () => {
    state.resolutionCalls += 1
    return state.resolvedProfile
      ? { ok: true, profile: state.resolvedProfile }
      : { ok: false, reason: 'identity-not-found' }
  }),
}))

import {
  createResolvedMemberMarker,
  createUnresolvedMemberMarker,
  getCurrentMemberProfile,
  getCurrentMemberProfileState,
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
  beforeEach(() => {
    state.currentSession = null
    state.sessionReadFails = false
    state.resolutionCalls = 0
    state.sessionUpdateFails = false
    state.updatedSession = null
    state.resolvedProfile = null
  })

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
    ['wrong version', { version: 3, status: 'resolved', profile: {} }],
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

  it('refreshes a version 1 profile so existing sessions receive Rock photos', async () => {
    state.currentSession = session({
      version: 1,
      status: 'resolved',
      profile: {
        personId: 42,
        name: 'Alex Member',
        email: 'alex@example.com',
        photoUrl: null,
      },
    })
    state.resolvedProfile = {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: '/GetAvatar.ashx?PhotoId=84&Size=400',
    }

    await expect(
      getCurrentMemberProfile({ persistLegacyProfile: true }),
    ).resolves.toEqual(
      state.resolvedProfile,
    )
    expect(state.updatedSession).toMatchObject({
      rockProfile: {
        version: 2,
        status: 'resolved',
        profile: state.resolvedProfile,
      },
    })
  })

  it('detects a legacy profile without contacting Rock during layout rendering', async () => {
    state.currentSession = session({
      version: 1,
      status: 'resolved',
      profile: {
        personId: 42,
        name: 'Alex Member',
        email: 'alex@example.com',
        photoUrl: null,
      },
    })

    await expect(getCurrentMemberProfileState()).resolves.toMatchObject({
      needsRefresh: true,
      profile: { personId: 42 },
    })
    expect(state.resolutionCalls).toBe(0)
    expect(state.updatedSession).toBeNull()
  })

  it('fails closed when the Auth0 identity resolves to a different person', async () => {
    state.currentSession = session({
      version: 1,
      status: 'resolved',
      profile: {
        personId: 42,
        name: 'Alex Member',
        email: 'alex@example.com',
        photoUrl: null,
      },
    })
    state.resolvedProfile = {
      personId: 99,
      name: 'Different Person',
      email: 'different@example.com',
      photoUrl: '/GetAvatar.ashx?PhotoId=100&Size=400',
    }

    await expect(
      getCurrentMemberProfile({ persistLegacyProfile: true }),
    ).resolves.toBeNull()
    expect(state.updatedSession).toBeNull()
  })

  it('fails closed when the legacy Rock identity no longer exists', async () => {
    state.currentSession = session({
      version: 1,
      status: 'resolved',
      profile: {
        personId: 42,
        name: 'Alex Member',
        email: 'alex@example.com',
        photoUrl: null,
      },
    })

    await expect(
      getCurrentMemberProfile({ persistLegacyProfile: true }),
    ).resolves.toBeNull()
    expect(state.updatedSession).toBeNull()
  })
})
