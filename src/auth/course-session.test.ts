import { describe, expect, it, vi } from 'vitest'
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('./auth0-client', () => ({ getAuth0Client: () => ({ getSession }) }))
vi.mock('./auth0-config', () => ({ readAuth0Config: () => ({ issuer: 'https://example.test/' }) }))
import { getCurrentCourseIdentity, isCourseReturnTo } from './course-session'

describe('course-only member completion', () => {
  it.each(['/members/courses', '/members/courses/sample', '/members/courses/attempts/1/lesson'])('permits the course subtree %s', path => expect(isCourseReturnTo(path)).toBe(true))
  it.each(['/members', '/members/giving', '/members/courses-admin', '/members/courses/../giving', '//elsewhere.test/members/courses', '/members/courses%2f..%2fgiving'])('does not broaden other portal access %s', path => expect(isCourseReturnTo(path)).toBe(false))
  it('accepts a verified account without a Rock profile', async () => {
    getSession.mockResolvedValue({ user: { sub: 'auth0|course', email: 'course@example.test', email_verified: true, name: 'Course participant' } })
    expect(await getCurrentCourseIdentity()).toMatchObject({ subject: 'auth0|course', name: 'Course participant' })
  })
  it('does not treat an unverified email as an account identity', async () => {
    getSession.mockResolvedValue({ user: { sub: 'auth0|course', email: 'course@example.test', email_verified: false } })
    expect(await getCurrentCourseIdentity()).toBeNull()
  })
})
