import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Auth0Identity } from '@/auth/auth0-identity'
const { find, findByID, update, query } = vi.hoisted(() => ({ find: vi.fn(), findByID: vi.fn(), update: vi.fn(), query: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({ find, findByID, update, db: { pool: { query } } }) }))
import { completeCourseLesson, getOwnedCourseAttempt, saveCourseLessonPosition } from './service'
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


const snapshot = {
  title: 'Course', slug: 'course', summary: '', allowSolo: true, allowGroup: true,
  lessons: ['one', 'two', 'three'].map((lessonId, index) => ({ lessonId, title: lessonId, required: index !== 1,
    blocks: [{ id: `${lessonId}-reading`, blockType: 'courseTeaching', body: { root: { type: 'root', version: 1, children: [], direction: null, format: '', indent: 0 } } }],
  })),
}
function progress(completed: string[], group = false) {
  find.mockResolvedValue({ docs: [{ id: 123, edition: 2, mode: group ? 'group' : 'solo', group: group ? 9 : null, membershipStatus: group ? 'left' : 'active', completedLessonIds: completed }] })
  findByID.mockResolvedValue({ id: 2, snapshot })
  query.mockResolvedValue({ rowCount: 1, rows: [] })
}
describe('sequential lesson progress', () => {
  it('rejects direct completion beyond the first unfinished lesson', async () => {
    progress([])
    await expect(completeCourseLesson(identity, 123, 'two')).rejects.toThrow('Lesson not found')
    expect(query).not.toHaveBeenCalled()
  })
  it('does not use legacy out-of-order completion to cross an earlier gap', async () => {
    progress(['one', 'three'])
    await expect(completeCourseLesson(identity, 123, 'three')).rejects.toThrow('Lesson not found')
    expect(query).not.toHaveBeenCalled()
  })
  it('permits revisiting an earlier completed lesson', async () => {
    progress(['one', 'two'])
    await expect(completeCourseLesson(identity, 123, 'one')).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledWith(expect.stringContaining('completed_lesson_ids @> $5::jsonb'), [123, identity.identityKey, '["one"]', '["one","three"]', '[]'])
  })
  it('checks every prior lesson atomically, including optional lessons', async () => {
    progress(['one', 'two'])
    await completeCourseLesson(identity, 123, 'three')
    expect(query.mock.calls[0][1][4]).toBe('["one","two"]')
  })
  it('rejects an atomic completion when stored prerequisites no longer match', async () => {
    progress(['one']); query.mockResolvedValue({ rowCount: 0, rows: [] })
    await expect(completeCourseLesson(identity, 123, 'two')).rejects.toThrow('earlier lessons')
  })
})
describe('saved walkthrough position', () => {
  it('saves a validated stable step for an owned unlocked lesson with an atomic frontier guard', async () => {
    progress(['one'])
    await saveCourseLessonPosition(identity, 123, 'two', 'two-reading')
    expect(query).toHaveBeenCalledWith(expect.stringContaining('jsonb_set'), [123, identity.identityKey, 'two', 'two-reading', '["one"]'])
    expect(query.mock.calls[0][0]).toContain('account_key=$2 AND completed_lesson_ids @> $5::jsonb')
  })
  it('rejects an unknown step without writing progress', async () => {
    progress([])
    await expect(saveCourseLessonPosition(identity, 123, 'one', 'injected')).rejects.toThrow('Step not found')
    expect(query).not.toHaveBeenCalled()
  })
  it('rejects a future lesson despite a legacy future completion flag', async () => {
    progress(['three'])
    await expect(saveCourseLessonPosition(identity, 123, 'three', 'three-reading')).rejects.toThrow('Lesson not found')
    expect(query).not.toHaveBeenCalled()
  })
  it('permits personal navigation on a former group member’s unlocked lesson', async () => {
    progress([], true)
    await saveCourseLessonPosition(identity, 123, 'one', 'one-reading')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][0]).toContain('UPDATE course_attempts')
  })
  it('does not move membership revocation timestamps when a former member saves navigation', async () => {
    progress([], true)
    await saveCourseLessonPosition(identity, 123, 'one', 'one-reading')
    const sql = query.mock.calls[0][0]
    expect(sql).toContain('lesson_positions = jsonb_set')
    expect(sql).not.toMatch(/\b(?:updated_at|membership_status|completed_at)\s*=/)
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('rejects saving position if the database frontier check fails', async () => {
    progress(['one']); query.mockResolvedValue({ rowCount: 0, rows: [] })
    await expect(saveCourseLessonPosition(identity, 123, 'two', 'two-reading')).rejects.toThrow('earlier lessons')
  })
})
