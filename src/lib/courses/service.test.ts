import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Auth0Identity } from '@/auth/auth0-identity'
const { find, findByID, update } = vi.hoisted(() => ({ find: vi.fn(), findByID: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({ find, findByID, update }) }))
import { completeCourseLesson, getOwnedCourseAttempt } from './service'
const identity: Auth0Identity = { identityKey: 'account-A', issuer: 'https://example.test/', subject: 'auth0|a', email: 'a@example.test', name: 'A' }
beforeEach(() => vi.resetAllMocks())
describe('course attempt authorization', () => {
  it('queries by account ownership before loading an edition', async () => {
    find.mockResolvedValue({ docs: [] })
    expect(await getOwnedCourseAttempt(identity, 123)).toBeNull()
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { and: [{ id: { equals: 123 } }, { accountKey: { equals: 'account-A' } }] } }))
    expect(findByID).not.toHaveBeenCalled()
  })
  it('does not update another account’s attempt', async () => {
    find.mockResolvedValue({ docs: [] })
    await expect(completeCourseLesson(identity, 123, 'lesson')).rejects.toThrow('Lesson not found')
    expect(update).not.toHaveBeenCalled()
  })
})
