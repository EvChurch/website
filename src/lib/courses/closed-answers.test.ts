import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Auth0Identity } from '@/auth/auth0-identity'
const { owned, query, lock, member, release } = vi.hoisted(() => ({ owned: vi.fn(), query: vi.fn(), lock: vi.fn(), member: vi.fn(), release: vi.fn() }))
vi.mock('./service', () => ({ getOwnedCourseAttempt: owned }))
vi.mock('./groups', () => ({ lockCourseGroup: lock, requireGroupMember: member }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({ db: { pool: { query, connect: async () => ({ query, release }) } } }) }))
import { saveCourseAnswer } from './answers'
const identity: Auth0Identity = { identityKey: 'alice-key', issuer: 'https://example.test/', subject: 'alice', email: 'alice@example.test', name: 'Alice' }
const group = { id: 9, edition_id: 2, status: 'closed' }
function attempt(visibility: 'personal' | 'shared', responseMode: 'individual' | 'group' = 'individual') {
  return { completed: [], attempt: { id: 1, mode: 'group', group: 9, membershipStatus: 'active' }, edition: { id: 2 }, snapshot: { lessons: [{ lessonId: 'l1', blocks: [{ id: 'q1', blockType: 'courseQuestion', inputType: 'text', prompt: 'Reflect', visibility, responseMode }] }] } }
}
beforeEach(() => {
  vi.resetAllMocks(); lock.mockResolvedValue(group); member.mockResolvedValue({ membership_status: 'active' })
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT * FROM course_groups')) return { rows: [group] }
    if (sql.startsWith('UPDATE course_answers')) return { rows: [{ block_id: 'q1', scope: 'personal', value: null, revision: 3, updated_at: '2026-11-26T00:00:00Z' }] }
    return { rows: [] }
  })
})
describe('closed group owner deletion', () => {
  it.each(['personal', 'shared'] as const)('allows the owner to clear their %s answer with a revisioned tombstone', async visibility => {
    owned.mockResolvedValue(attempt(visibility))
    expect(await saveCourseAnswer(identity, 1, 'l1', 'q1', 2, null)).toMatchObject({ status: 'saved', answer: { value: null, revision: 3 } })
    expect(query).toHaveBeenCalledWith(expect.stringContaining('AND revision=$2'), [expect.any(String), 2, 'null'])
    expect(query).toHaveBeenCalledWith('COMMIT')
  })
  it('preserves personal deletion after the participant leaves', async () => {
    const own = attempt('personal'); own.attempt.membershipStatus = 'left'; owned.mockResolvedValue(own)
    expect((await saveCourseAnswer(identity, 1, 'l1', 'q1', 2, null)).status).toBe('saved')
    expect(member).not.toHaveBeenCalled()
  })
  it.each(['personal', 'shared'] as const)('still rejects non-empty %s edits', async visibility => {
    owned.mockResolvedValue(attempt(visibility))
    await expect(saveCourseAnswer(identity, 1, 'l1', 'q1', 2, 'Changed')).rejects.toThrow('closed')
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE course_answers'))).toBe(false)
    expect(query).toHaveBeenCalledWith('ROLLBACK')
  })
  it('rejects clearing the group-owned answer', async () => {
    owned.mockResolvedValue(attempt('shared', 'group'))
    await expect(saveCourseAnswer(identity, 1, 'l1', 'q1', 2, null)).rejects.toThrow('closed')
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE course_answers'))).toBe(false)
  })
  it('does not re-enable access to an individually shared answer after leaving', async () => {
    owned.mockResolvedValue(attempt('shared')); member.mockRejectedValue(new Error('Group not found.'))
    await expect(saveCourseAnswer(identity, 1, 'l1', 'q1', 2, null)).rejects.toThrow('Group not found')
    expect(lock).not.toHaveBeenCalled()
  })
})
