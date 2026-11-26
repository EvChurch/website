import { createHash } from 'node:crypto'
import type { Course } from '@/payload-types'

export type CourseLesson = NonNullable<Course['lessons']>[number]
export type CourseBlock = NonNullable<CourseLesson['blocks']>[number]
export interface CourseSnapshot {
  title: string
  slug: string
  summary: string
  allowSolo: boolean
  allowGroup: boolean
  lessons: CourseLesson[]
}

export function snapshotCourse(course: Course): CourseSnapshot {
  return { title: course.title, slug: course.slug, summary: course.summary,
    allowSolo: course.allowSolo !== false, allowGroup: course.allowGroup !== false,
    lessons: course.lessons ?? [] }
}

/** Wording may change in place; identities, order, types and requirements may not. */
export function courseStructureKey(snapshot: CourseSnapshot): string {
  const structure = snapshot.lessons.map(lesson => ({
    id: lesson.lessonId, required: lesson.required !== false,
    blocks: (lesson.blocks ?? []).map(block => ({ id: block.id, type: block.blockType,
      ...(block.blockType === 'courseQuestion' ? { inputType: block.inputType, visibility: block.visibility, responseMode: block.responseMode, required: !!block.required, choices: block.choices?.map(choice => choice.choiceId) } : {}),
    })),
  }))
  return createHash('sha256').update(JSON.stringify(structure)).digest('hex')
}

export function readCourseSnapshot(value: unknown): CourseSnapshot {
  if (!value || typeof value !== 'object' || !('title' in value) || typeof value.title !== 'string' ||
    !('slug' in value) || typeof value.slug !== 'string' || !('summary' in value) || typeof value.summary !== 'string' ||
    !('lessons' in value) || !Array.isArray(value.lessons) || value.lessons.some(lesson =>
      !lesson || typeof lesson !== 'object' || typeof lesson.lessonId !== 'string' || typeof lesson.title !== 'string')) {
    throw new Error('Invalid course edition')
  }
  return value as CourseSnapshot
}

export function completedLessonIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

export function isCourseComplete(snapshot: CourseSnapshot, completed: string[]) {
  return snapshot.lessons.filter(lesson => lesson.required !== false).every(lesson => completed.includes(lesson.lessonId))
}
