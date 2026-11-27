import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Auth0Identity } from '@/auth/auth0-identity'
const { owned, query } = vi.hoisted(() => ({ owned: vi.fn(), query: vi.fn() }))
vi.mock('./service', () => ({ getOwnedCourseAttempt: owned }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({ db: { pool: { query } } }) }))
import { getCourseAnswerContext, getCourseLessonAnswers, readCourseAnswer, readOtherCourseAnswers, requiredCourseAnswersComplete, saveCourseAnswer } from './answers'
const identity: Auth0Identity = { identityKey: 'alice-key', issuer: 'https://example.test/', subject: 'alice', email: 'alice@example.test', name: 'Alice' }
const attempt = { completed: [], attempt: { id: 1, mode: 'solo' }, edition: { id: 2 }, snapshot: { lessons: [{ lessonId: 'l1', blocks: [{ id: 'q1', blockType: 'courseQuestion', inputType: 'text', prompt: 'Reflect', visibility: 'shared', responseMode: 'group' }] }] } }
beforeEach(() => { vi.resetAllMocks(); owned.mockResolvedValue(attempt) })
describe('course answer ownership and atomic updates', () => {
  it('does not query private answers before attempt ownership succeeds', async () => {
    owned.mockResolvedValue(null)
    await expect(readCourseAnswer(identity, 99, 'l1', 'q1')).rejects.toThrow('Answer not found')
    expect(query).not.toHaveBeenCalled()
  })
  it('keeps solo answers personal even for shared question blocks', async () => {
    expect((await getCourseAnswerContext(identity, 1, 'l1', 'q1')).scope).toBe('personal')
  })
  it('denies group scopes until group membership is implemented', async () => {
    owned.mockResolvedValue({ ...attempt, attempt: { id: 1, mode: 'group' } })
    await expect(readCourseAnswer(identity, 1, 'l1', 'q1')).rejects.toThrow()
    expect(query).not.toHaveBeenCalled()
  })
  it('uses compare-and-swap, returning the saved answer when a stale tab loses', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ block_id: 'q1', scope: 'personal', value: 'Newer', revision: 3, updated_at: '2026-11-26T00:00:00Z' }] })
    const result = await saveCourseAnswer(identity, 1, 'l1', 'q1', 2, 'Stale')
    expect(result).toMatchObject({ status: 'conflict', answer: { value: 'Newer', revision: 3 } })
    expect(query.mock.calls[0][0]).toContain('AND revision=$2')
    expect(query.mock.calls[0][1].slice(1)).toEqual([2, '"Stale"'])
  })
  it('retains a deletion tombstone with a new revision', async () => {
    query.mockResolvedValueOnce({ rows: [{ block_id: 'q1', scope: 'personal', value: null, revision: 4, updated_at: '2026-11-26T00:00:00Z' }] })
    expect(await saveCourseAnswer(identity, 1, 'l1', 'q1', 3, null)).toMatchObject({ status: 'saved', answer: { value: null, revision: 4 } })
    expect(query.mock.calls[0][0]).toContain('revision=revision+1')
  })
  it('rejects an unknown block and invalid revision without querying answers', async () => {
    await expect(saveCourseAnswer(identity, 1, 'l1', 'other', 0, 'x')).rejects.toThrow()
    await expect(saveCourseAnswer(identity, 1, 'l1', 'q1', -1, 'x')).rejects.toThrow()
    expect(query).not.toHaveBeenCalled()
  })
})


describe('answer lesson frontier', () => {
  const future = { lessonId: 'l2', blocks: [{ id: 'future', blockType: 'courseQuestion', inputType: 'text', prompt: 'Future', visibility: 'personal' }] }
  beforeEach(() => owned.mockResolvedValue({ ...attempt, completed: ['l2'], snapshot: { lessons: [...attempt.snapshot.lessons, future] } }))
  it('rejects a direct future answer read before querying saved answers', async () => {
    await expect(readCourseAnswer(identity, 1, 'l2', 'future')).rejects.toThrow('Answer not found')
    expect(query).not.toHaveBeenCalled()
  })
  it('rejects writes and other-participant reads across the gap', async () => {
    await expect(saveCourseAnswer(identity, 1, 'l2', 'future', 0, 'skip')).rejects.toThrow('Answer not found')
    await expect(readOtherCourseAnswers(identity, 1, 'l2', 'future')).rejects.toThrow('Answer not found')
    expect(query).not.toHaveBeenCalled()
  })
  it('rejects the future lesson answer list and required-completion check', async () => {
    await expect(getCourseLessonAnswers(identity, 1, 'l2')).rejects.toThrow('Lesson not found')
    expect(await requiredCourseAnswersComplete(identity, 1, 'l2')).toBe(false)
    expect(query).not.toHaveBeenCalled()
  })
  it('keeps an earlier completed lesson available for answer reads', async () => {
    owned.mockResolvedValue({ ...attempt, completed: ['l1'] })
    query.mockResolvedValue({ rows: [] })
    expect(await readCourseAnswer(identity, 1, 'l1', 'q1')).toMatchObject({ blockId: 'q1', revision: 0 })
  })
})
