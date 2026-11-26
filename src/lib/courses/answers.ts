import { createHash } from 'node:crypto'
import type { Auth0Identity } from '@/auth/auth0-identity'
import { getPayloadClient } from '@/lib/payload'
import { getOwnedCourseAttempt } from './service'
import { coursePostgresPool } from './postgres'
import { isQuestionBlock, validateCourseAnswer, courseAnswerComplete, type CourseQuestion, type CourseAnswerState, type CourseAnswerScope, type CourseAnswerValue, type CourseSaveResult } from './answer-model'

export interface CourseAnswerContext {
  responseKey: string
  attemptId: number
  editionId: number
  lessonId: string
  block: CourseQuestion
  ownerKey: string
  scope: CourseAnswerScope
}

/** Group support must replace this denial with a server membership check, not client IDs. */
export async function getCourseAnswerContext(identity: Auth0Identity, attemptId: number, lessonId: string, blockId: string): Promise<CourseAnswerContext> {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  if (!owned || owned.attempt.mode !== 'solo') throw new Error('Answer not found.')
  const lesson = owned.snapshot.lessons.find(item => item.lessonId === lessonId)
  const block = lesson?.blocks?.find(item => item.id === blockId)
  if (!block || !isQuestionBlock(block)) throw new Error('Answer not found.')
  const editionId = owned.edition.id
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
  return result.rows[0] ? state(result.rows[0]) : empty(context)
}

/** A cleared answer remains a revisioned tombstone, preventing stale tabs from recreating it. */
export async function saveCourseAnswer(identity: Auth0Identity, attemptId: number, lessonId: string, blockId: string, expectedRevision: number, input: unknown): Promise<CourseSaveResult> {
  const context = await getCourseAnswerContext(identity, attemptId, lessonId, blockId)
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid answer version.')
  const value = validateCourseAnswer(context.block, input)
  const pool = coursePostgresPool(await getPayloadClient())
  const result = expectedRevision === 0
    ? await pool.query<AnswerRow>(`INSERT INTO course_answers (response_key, attempt_id, edition_id, lesson_id, block_id, owner_key, scope, value, revision, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,1,now(),now()) ON CONFLICT (response_key) DO NOTHING
        RETURNING block_id, scope, value, revision, updated_at`, [context.responseKey, context.attemptId, context.editionId, context.lessonId, blockId, context.ownerKey, context.scope, JSON.stringify(value)])
    : await pool.query<AnswerRow>(`UPDATE course_answers SET value=$3::jsonb, revision=revision+1, updated_at=now()
        WHERE response_key=$1 AND revision=$2 RETURNING block_id, scope, value, revision, updated_at`, [context.responseKey, expectedRevision, JSON.stringify(value)])
  if (result.rows[0]) return { status: 'saved', answer: state(result.rows[0]) }
  return { status: 'conflict', answer: await readCourseAnswer(identity, attemptId, lessonId, blockId) }
}

export async function getCourseLessonAnswers(identity: Auth0Identity, attemptId: number, lessonId: string) {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  const lesson = owned?.snapshot.lessons.find(item => item.lessonId === lessonId)
  if (!owned || !lesson || owned.attempt.mode !== 'solo') throw new Error('Lesson not found.')
  const answers = await Promise.all((lesson.blocks ?? []).filter(isQuestionBlock).map(block => readCourseAnswer(identity, attemptId, lessonId, block.id!)))
  return Object.fromEntries(answers.map(answer => [answer.blockId, answer]))
}

export async function requiredCourseAnswersComplete(identity: Auth0Identity, attemptId: number, lessonId: string): Promise<boolean> {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  const lesson = owned?.snapshot.lessons.find(item => item.lessonId === lessonId)
  if (!owned || !lesson) return false
  const required = (lesson.blocks ?? []).filter(isQuestionBlock).filter(block => block.required)
  if (!required.length) return true
  const answers = await getCourseLessonAnswers(identity, attemptId, lessonId)
  return required.every(block => courseAnswerComplete(block, answers[block.id!]?.value ?? null))
}
