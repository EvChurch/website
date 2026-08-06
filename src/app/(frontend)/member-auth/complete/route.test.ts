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
vi.mock('@/auth/auth0-config', () => ({
  readAuth0Config: () => ({ appBaseUrl: 'https://www.ev.church' }),
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
        'http://0.0.0.0:3000/member-auth/complete?returnTo=%2Fevents%3Fcampus%3D2',
      ),
    )

    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/events?campus=2',
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it.each(['//evil.example/path', '/admin'])(
    'falls back to the public home page for unsafe returnTo %s',
    async (returnTo) => {
      state.profile = {
        personId: 42,
        name: 'Alex Member',
        email: 'alex@example.com',
        photoUrl: null,
      }

      const response = await GET(
        new NextRequest(
          `http://0.0.0.0:3000/member-auth/complete?returnTo=${encodeURIComponent(returnTo)}`,
        ),
      )

      expect(response.headers.get('location')).toBe('https://www.ev.church/')
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    },
  )

  it('reports an unresolved member without destroying the shared Auth0 session', async () => {
    const response = await GET(
      new NextRequest(
        'http://0.0.0.0:3000/member-auth/complete?returnTo=%2Fadmin',
      ),
    )

    expect(response.headers.get('location')).toBe(
      'https://www.ev.church/member-sign-in/error',
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
