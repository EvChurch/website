import type { PoolClient } from 'pg'
import type { Auth0Identity } from '@/auth/auth0-identity'
import type { Course, CourseAttempt } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import { completedLessonIds, readCourseSnapshot } from './model'
import { coursePostgresPool } from './postgres'
import { canAccessCourseLesson, lessonSteps } from './lesson-flow'

export async function listAvailableCourses() {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'courses', where: { and: [{ _status: { equals: 'published' } }, { enrolmentOpen: { equals: true } }] }, select: { title: true, slug: true, summary: true, allowSolo: true, allowGroup: true }, sort: 'title', depth: 0, limit: 100, overrideAccess: true })
  return result.docs
}

export async function findPublishedCourse(slug: string): Promise<Course | null> {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'courses', where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }, depth: 0, limit: 1, overrideAccess: true })
  return result.docs[0] ?? null
}

export async function latestCourseEdition(courseId: number) {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'course-editions', where: { course: { equals: courseId } }, sort: '-id', depth: 0, limit: 1, overrideAccess: true })
  return result.docs[0] ?? null
}

export async function getOwnedCourseAttempt(identity: Auth0Identity, attemptId: number) {
  if (!Number.isSafeInteger(attemptId) || attemptId <= 0) return null
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'course-attempts', where: { and: [{ id: { equals: attemptId } }, { accountKey: { equals: identity.identityKey } }] }, depth: 0, limit: 1, overrideAccess: true })
  const attempt = result.docs[0]
  if (!attempt) return null
  const editionId = typeof attempt.edition === 'number' ? attempt.edition : attempt.edition.id
  const edition = await payload.findByID({ collection: 'course-editions', id: editionId, depth: 0, overrideAccess: true })
  return { attempt, edition, snapshot: readCourseSnapshot(edition.snapshot), completed: completedLessonIds(attempt.completedLessonIds) }
}

export async function listCourseAttempts(identity: Auth0Identity) {
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'course-attempts', where: { accountKey: { equals: identity.identityKey } }, sort: '-updatedAt', depth: 0, limit: 100, overrideAccess: true })
  const attempts = await Promise.all(result.docs.map(attempt => getOwnedCourseAttempt(identity, attempt.id)))
  const groupIds = attempts.flatMap(item => { const group = item?.attempt.group; return group ? [typeof group === 'number' ? group : group.id] : [] })
  const groups = groupIds.length ? await coursePostgresPool(payload).query<{ id: number; name: string }>('SELECT id,name FROM course_groups WHERE id=ANY($1::int[])', [groupIds]) : { rows: [] }
  const names = new Map(groups.rows.map(group => [group.id, group.name]))
  return attempts.map(item => item ? { ...item, groupName: names.get(typeof item.attempt.group === 'number' ? item.attempt.group : item.attempt.group?.id ?? 0) } : null)
}

export async function startSoloCourse(identity: Auth0Identity, slug: string): Promise<CourseAttempt> {
  const course = await findPublishedCourse(slug)
  if (!course || !course.enrolmentOpen || course.allowSolo === false) throw new Error('This course is not open for solo enrolment.')
  const edition = await latestCourseEdition(course.id)
  if (!edition) throw new Error('This course is not available yet.')
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'course-attempts', where: { and: [{ accountKey: { equals: identity.identityKey } }, { edition: { equals: edition.id } }, { mode: { equals: 'solo' } }, { completedAt: { exists: false } }] }, depth: 0, limit: 1, overrideAccess: true })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({ collection: 'course-attempts', data: { accountKey: identity.identityKey, edition: edition.id, mode: 'solo', membershipStatus: 'active', completedLessonIds: [] }, overrideAccess: true })
}

export async function completeCourseLesson(identity: Auth0Identity, attemptId: number, lessonId: string) {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  if (!owned || !canAccessCourseLesson(owned.snapshot, owned.completed, lessonId)) throw new Error('Lesson not found.')
  const { requiredCourseAnswersComplete } = await import('./answers')
  if (!await requiredCourseAnswersComplete(identity, attemptId, lessonId)) throw new Error('Complete the required questions first.')
  const payload = await getPayloadClient()
  const required = owned.snapshot.lessons.filter(lesson => lesson.required !== false).map(lesson => lesson.lessonId)
  const prerequisites = owned.snapshot.lessons.slice(0, owned.snapshot.lessons.findIndex(lesson => lesson.lessonId === lessonId)).map(lesson => lesson.lessonId)
  // Append atomically: two tabs finishing different lessons cannot erase progress.
  const update = (client: Pick<PoolClient, 'query'>) => client.query(`UPDATE course_attempts SET
    completed_lesson_ids = (SELECT jsonb_agg(DISTINCT item) FROM jsonb_array_elements(completed_lesson_ids || $3::jsonb) AS item),
    completed_at = CASE WHEN (completed_lesson_ids || $3::jsonb) @> $4::jsonb THEN COALESCE(completed_at, now()) ELSE completed_at END,
    updated_at = now()
    WHERE id = $1 AND account_key = $2 AND completed_lesson_ids @> $5::jsonb`, [attemptId, identity.identityKey, JSON.stringify([lessonId]), JSON.stringify(required), JSON.stringify(prerequisites)])
  if (owned.attempt.mode === 'group') {
    const groupId = typeof owned.attempt.group === 'number' ? owned.attempt.group : owned.attempt.group?.id
    if (!groupId) throw new Error('Group not found.')
    const { withCourseGroupWrite } = await import('./groups')
    const result = await withCourseGroupWrite(identity, groupId, update)
    if (!result.rowCount) throw new Error('Finish the earlier lessons first.')
  } else {
    const result = await update(coursePostgresPool(payload))
    if (!result.rowCount) throw new Error('Finish the earlier lessons first.')
  }
}

/** Navigation belongs to this account, including when its group is closed or left. */
export async function saveCourseLessonPosition(identity: Auth0Identity, attemptId: number, lessonId: string, stepId: string): Promise<void> {
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  if (!owned || !canAccessCourseLesson(owned.snapshot, owned.completed, lessonId)) throw new Error('Lesson not found.')
  const index = owned.snapshot.lessons.findIndex(lesson => lesson.lessonId === lessonId)
  const lesson = owned.snapshot.lessons[index]
  if (!lessonSteps(lesson).some(step => step.id === stepId)) throw new Error('Step not found.')
  const prerequisites = owned.snapshot.lessons.slice(0, index).map(item => item.lessonId)
  const pool = coursePostgresPool(await getPayloadClient())
  const result = await pool.query(`UPDATE course_attempts SET
    lesson_positions = jsonb_set(CASE WHEN jsonb_typeof(lesson_positions)='object' THEN lesson_positions ELSE '{}'::jsonb END, ARRAY[$3::text], to_jsonb($4::text), true),
    updated_at = now()
    WHERE id=$1 AND account_key=$2 AND completed_lesson_ids @> $5::jsonb`,
    [attemptId, identity.identityKey, lessonId, stepId, JSON.stringify(prerequisites)])
  if (!result.rowCount) throw new Error('Finish the earlier lessons first.')
}
