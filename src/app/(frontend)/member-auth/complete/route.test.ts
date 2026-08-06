import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  profile: null as null | {
    personId: number
    name: string
    email: string
    photoUrl: string | null
  },
}))

vi.mock('@/auth/member-session', () => ({
  getCurrentMemberProfile: vi.fn(async () => state.profile),
}))
vi.mock('@/auth/member-auth0-config', () => ({
  readMemberAuth0Config: () => ({ appBaseUrl: 'https://www.ev.church/' }),
}))

import { GET } from './route'

describe('member auth completion', () => {
  beforeEach(() => {
    state.profile = null
  })

  it('returns a resolved member to the sanitized public path', async () => {
    state.profile = {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: null,
    }

    const response = await GET(
      new NextRequest(
        'https://www.ev.church/member-auth/complete?returnTo=%2Fevents%3Fcampus%3D2',
      ),
    )

    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/events?campus=2',
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('sends an unresolved member through member logout before retry', async () => {
    const response = await GET(
      new NextRequest(
        'https://www.ev.church/member-auth/complete?returnTo=%2Fadmin',
      ),
    )

    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/member-auth/logout?returnTo=https%3A%2F%2Fwww.ev.church%2Fmember-sign-in%2Ferror',
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
