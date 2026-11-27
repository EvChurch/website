import { createHash } from 'node:crypto'
import type { Auth0Identity } from '@/auth/auth0-identity'
import { getPayloadClient } from '@/lib/payload'
import { getOwnedCourseAttempt } from './service'
import { canAccessCourseLesson } from './lesson-flow'
import { coursePostgresPool } from './postgres'
import { lockCourseGroup, requireGroupMember, type CourseGroupRow } from './groups'
import { isAnswerableBlock, validateCourseAnswer, courseAnswerComplete, type CourseAnswerableBlock, type CourseAnswerState, type CourseAnswerScope, type CourseAnswerValue, type CourseSaveResult } from './answer-model'

export interface CourseAnswerContext {
  responseKey: string
  attemptId: number
  editionId: number
  lessonId: string
  block: CourseAnswerableBlock
  ownerKey: string
  scope: CourseAnswerScope
  groupId?: number
  readOnly?: boolean
}

/** Derive scope from the pinned edition and server membership, never from client input. */
export async function getCourseAnswerContext(identity: Auth0Identity, attemptId: number, lessonId: string, blockId: string): Promise<CourseAnswerContext> {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  if (!owned || !canAccessCourseLesson(owned.snapshot, owned.completed, lessonId)) throw new Error('Answer not found.')
  const lesson = owned.snapshot.lessons.find(item => item.lessonId === lessonId)
  const block = lesson?.blocks?.find(item => item.id === blockId)
  if (!block || !isAnswerableBlock(block)) throw new Error('Answer not found.')
  const editionId = owned.edition.id
  const groupId = typeof owned.attempt.group === 'number' ? owned.attempt.group : owned.attempt.group?.id
  if (owned.attempt.mode === 'group') {
    if (!groupId) throw new Error('Answer not found.')
    const pool = coursePostgresPool(await getPayloadClient())
    const group = (await pool.query<CourseGroupRow>('SELECT * FROM course_groups WHERE id=$1', [groupId])).rows[0]
    if (!group || group.edition_id !== editionId) throw new Error('Answer not found.')
    if (block.visibility === 'shared') {
      await requireGroupMember(pool, identity, groupId)
      const scope = block.responseMode === 'individual' ? 'individual-shared' : 'group'
      const ownerKey = scope === 'group' ? `group:${groupId}` : identity.identityKey
      const responseKey = createHash('sha256').update(JSON.stringify([scope, groupId, editionId, lessonId, blockId, ownerKey])).digest('hex')
      return { responseKey, attemptId, editionId, lessonId, block, ownerKey, scope, groupId, readOnly: group.status === 'closed' }
    }
    const responseKey = createHash('sha256').update(JSON.stringify([attemptId, editionId, lessonId, blockId, identity.identityKey])).digest('hex')
    return { responseKey, attemptId, editionId, lessonId, block, ownerKey: identity.identityKey, scope: 'personal', groupId, readOnly: group.status === 'closed' }
  }
  const responseKey = createHash('sha256').update(JSON.stringify([attemptId, editionId, lessonId, blockId, identity.identityKey])).digest('hex')
  return { responseKey, attemptId, editionId, lessonId, block, ownerKey: identity.identityKey, scope: 'personal' }
}

interface AnswerRow { block_id: string; scope: CourseAnswerScope; value: CourseAnswerValue; revision: number; updated_at: Date | string }
function state(row: AnswerRow): CourseAnswerState {
  return { blockId: row.block_id, scope: row.scope, value: row.value, revision: Number(row.revision), updatedAt: new Date(row.updated_at).toISOString() }
}
function empty(context: CourseAnswerContext): CourseAnswerState {
  return { blockId: context.block.id!, scope: context.scope, value: null, revision: 0, updatedAt: null }
}

export async function readCourseAnswer(identity: Auth0Identity, attemptId: number, lessonId: string, blockId: string): Promise<CourseAnswerState> {
  const context = await getCourseAnswerContext(identity, attemptId, lessonId, blockId)
  const pool = coursePostgresPool(await getPayloadClient())
  const result = await pool.query<AnswerRow>('SELECT block_id, scope, value, revision, updated_at FROM course_answers WHERE response_key = $1', [context.responseKey])
  return { ...(result.rows[0] ? state(result.rows[0]) : empty(context)), readOnly: context.readOnly ?? false }
}

/** A cleared answer remains a revisioned tombstone, preventing stale tabs from recreating it. */
export async function saveCourseAnswer(identity: Auth0Identity, attemptId: number, lessonId: string, blockId: string, expectedRevision: number, input: unknown): Promise<CourseSaveResult> {
  const context = await getCourseAnswerContext(identity, attemptId, lessonId, blockId)
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid answer version.')
  const value = validateCourseAnswer(context.block, input)
  const pool = coursePostgresPool(await getPayloadClient())
  const client = context.groupId ? await pool.connect() : { query: pool.query.bind(pool), release() {} }
  try {
  if (context.groupId) await client.query('BEGIN')
  if (context.groupId) {
    const group = await lockCourseGroup(client, context.groupId)
    const deletingOwnAnswer = value === null && context.scope !== 'group' && context.ownerKey === identity.identityKey
    if (group.status !== 'active' && !deletingOwnAnswer) throw new Error('This group is closed.')
    if (context.scope !== 'personal') await requireGroupMember(client, identity, context.groupId)
  }
  const result = expectedRevision === 0
    ? await client.query<AnswerRow>(`INSERT INTO course_answers (response_key, attempt_id, edition_id, lesson_id, block_id, owner_key, scope, value, revision, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,1,now(),now()) ON CONFLICT (response_key) DO NOTHING
        RETURNING block_id, scope, value, revision, updated_at`, [context.responseKey, context.attemptId, context.editionId, context.lessonId, blockId, context.ownerKey, context.scope, JSON.stringify(value)])
    : await client.query<AnswerRow>(`UPDATE course_answers SET value=$3::jsonb, revision=revision+1, updated_at=now()
        WHERE response_key=$1 AND revision=$2 RETURNING block_id, scope, value, revision, updated_at`, [context.responseKey, expectedRevision, JSON.stringify(value)])
  const current = result.rows[0] ? null : await client.query<AnswerRow>('SELECT block_id, scope, value, revision, updated_at FROM course_answers WHERE response_key=$1', [context.responseKey])
  if (context.groupId) await client.query('COMMIT')
  if (result.rows[0]) return { status: 'saved', answer: state(result.rows[0]) }
  return { status: 'conflict', answer: current?.rows[0] ? state(current.rows[0]) : empty(context) }
  } catch (error) { if (context.groupId) await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}

export async function getCourseLessonAnswers(identity: Auth0Identity, attemptId: number, lessonId: string) {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  const lesson = owned?.snapshot.lessons.find(item => item.lessonId === lessonId)
  if (!owned || !lesson || !canAccessCourseLesson(owned.snapshot, owned.completed, lessonId)) throw new Error('Lesson not found.')
  const answers = await Promise.all((lesson.blocks ?? []).filter(isAnswerableBlock).filter(block => owned.attempt.mode !== 'group' || owned.attempt.membershipStatus === 'active' || block.visibility !== 'shared').map(block => readCourseAnswer(identity, attemptId, lessonId, block.id!)))
  return Object.fromEntries(answers.map(answer => [answer.blockId, answer]))
}

export async function requiredCourseAnswersComplete(identity: Auth0Identity, attemptId: number, lessonId: string): Promise<boolean> {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  const lesson = owned?.snapshot.lessons.find(item => item.lessonId === lessonId)
  if (!owned || !lesson || !canAccessCourseLesson(owned.snapshot, owned.completed, lessonId)) return false
  if (owned.attempt.mode === 'group') {
    if (owned.attempt.membershipStatus !== 'active') return false
    const groupId = typeof owned.attempt.group === 'number' ? owned.attempt.group : owned.attempt.group?.id
    if (!groupId) return false
    const group = await coursePostgresPool(await getPayloadClient()).query<CourseGroupRow>('SELECT * FROM course_groups WHERE id=$1', [groupId])
    if (group.rows[0]?.status !== 'active') return false
  }
  const required = (lesson.blocks ?? []).filter(isAnswerableBlock).filter(block => block.required)
  if (!required.length) return true
  const answers = await getCourseLessonAnswers(identity, attemptId, lessonId)
  return required.every(block => courseAnswerComplete(block, answers[block.id!]?.value ?? null))
}

export async function readOtherCourseAnswers(identity: Auth0Identity, attemptId: number, lessonId: string, blockId: string) {
  const context = await getCourseAnswerContext(identity, attemptId, lessonId, blockId)
  if (context.scope !== 'individual-shared' || !context.groupId) return []
  const pool = coursePostgresPool(await getPayloadClient())
  const result = await pool.query<{ display_name: string | null; value: CourseAnswerValue }>(`SELECT p.display_name,a.value FROM course_answers a JOIN course_attempts p ON p.id=a.attempt_id WHERE p.group_id=$1 AND a.edition_id=$2 AND a.lesson_id=$3 AND a.block_id=$4 AND a.scope='individual-shared' AND a.owner_key<>$5 AND a.value IS NOT NULL AND a.value<>'null'::jsonb ORDER BY a.id`, [context.groupId,context.editionId,lessonId,blockId,identity.identityKey])
  return result.rows.map(row => ({ name: row.display_name || 'Participant', value: row.value }))
}
