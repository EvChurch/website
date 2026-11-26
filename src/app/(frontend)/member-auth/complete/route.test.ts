import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Auth0Identity } from '@/auth/auth0-identity'

const state = vi.hoisted(() => ({
  identity: null as Auth0Identity | null,
  profile: null as null | {
    personId: number
    name: string
    email: string
    photoUrl: string | null
  },
}))

vi.mock('@/auth/course-session', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/auth/course-session')>(),
  getCurrentCourseIdentity: vi.fn(async () => state.identity),
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
    state.identity = null
  })

  const accountIdentity: Auth0Identity = {
    identityKey: 'course-account',
    issuer: 'https://auth.example.com/',
    subject: 'auth0|course-account',
    email: 'participant@example.com',
    name: 'Alex Participant',
  }

  it('returns an account without a Rock profile to Courses from the member landing', async () => {
    state.identity = accountIdentity

    const response = await GET(new NextRequest(
      'http://localhost:3100/member-auth/complete?returnTo=%2Fmembers',
    ))

    expect(response.headers.get('location')).toBe('https://www.ev.church/members/courses')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('keeps anonymous member landing completion unsuccessful', async () => {
    const response = await GET(new NextRequest(
      'http://localhost:3100/member-auth/complete?returnTo=%2Fmembers',
    ))

    expect(response.headers.get('location')).toBe('https://www.ev.church/member-sign-in/error')
  })

  it.each(['/members/giving', '/members/connect-groups', '/members?tab=giving'])(
    'does not extend account-only completion to %s', async (returnTo) => {
      state.identity = accountIdentity

      const response = await GET(new NextRequest(
        `http://localhost:3100/member-auth/complete?returnTo=${encodeURIComponent(returnTo)}`,
      ))

      expect(response.headers.get('location')).toBe('https://www.ev.church/member-sign-in/error')
    },
  )

  it('preserves a course return path for an account without a Rock profile', async () => {
    state.identity = accountIdentity

    const response = await GET(new NextRequest(
      'http://localhost:3100/member-auth/complete?returnTo=%2Fmembers%2Fcourses%2Ffaithful-with-money',
    ))

    expect(response.headers.get('location')).toBe('https://www.ev.church/members/courses/faithful-with-money')
  })

  it('requires a signed-in identity for a course return path', async () => {
    const response = await GET(new NextRequest(
      'http://localhost:3100/member-auth/complete?returnTo=%2Fmembers%2Fcourses',
    ))

    expect(response.headers.get('location')).toBe('https://www.ev.church/member-sign-in/error')
  })

  it('keeps the member landing for a resolved Rock profile', async () => {
    state.profile = { personId: 42, name: 'Alex Member', email: 'alex@example.com', photoUrl: null }

    const response = await GET(new NextRequest(
      'http://localhost:3100/member-auth/complete?returnTo=%2Fmembers',
    ))

    expect(response.headers.get('location')).toBe('https://www.ev.church/members')
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
