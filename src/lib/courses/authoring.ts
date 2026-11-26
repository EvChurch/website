import { randomUUID } from 'node:crypto'
import type { CollectionBeforeValidateHook } from 'payload'
import type { Course } from '@/payload-types'
import type { CourseLesson } from './model'

type Row = { id?: string | null }

/** Payload duplicates custom read-only values along with array rows. */
function normalizeRows<T extends Row>(rows: T[], original: T[], key: keyof T, nextId: () => string): T[] {
  const originalRows = new Map(original.filter(row => row.id).map(row => [row.id, row]))
  const reserved = new Set<string>(original.flatMap(row => { const id = row[key]; return typeof id === 'string' ? [id] : [] }))
  const used = new Set<string>()
  return rows.map(row => {
    const previous = row.id ? originalRows.get(row.id) : undefined
    const value = previous?.[key] ?? row[key]
    let id = typeof value === 'string' ? value : ''
    if (!previous && (!id || reserved.has(id) || used.has(id))) {
      do { id = nextId() } while (reserved.has(id) || used.has(id))
    }
    used.add(id)
    return { ...row, [key]: id }
  })
}

export function normalizeCourseRowIds(lessons: CourseLesson[], original: CourseLesson[] = [], nextId: () => string = randomUUID): CourseLesson[] {
  const normalized = normalizeRows(lessons, original, 'lessonId', nextId)
  return normalized.map(lesson => {
    const previous = lesson.id ? original.find(row => row.id === lesson.id) : undefined
    return { ...lesson, blocks: lesson.blocks?.map(block => {
      const priorBlock = block.id ? previous?.blocks?.find(row => row.id === block.id) : undefined
      if (block.blockType === 'courseBudget') return { ...block, categories: normalizeRows(block.categories ?? [],
        priorBlock?.blockType === 'courseBudget' ? priorBlock.categories ?? [] : [], 'categoryId', nextId) }
      if (block.blockType === 'courseQuestion') return { ...block, choices: block.choices ? normalizeRows(block.choices,
        priorBlock?.blockType === 'courseQuestion' ? priorBlock.choices ?? [] : [], 'choiceId', nextId) : block.choices }
      return block
    }) ?? lesson.blocks }
  })
}

function requireUnique(ids: string[], label: string) {
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error(`Course ${label} must have unique IDs before publishing.`)
}

export function validateCourseRowIds(lessons: CourseLesson[]) {
  requireUnique(lessons.map(lesson => lesson.lessonId), 'lessons')
  for (const lesson of lessons) {
    requireUnique((lesson.blocks ?? []).flatMap(block => block.id ? [block.id] : []), 'lesson blocks')
    for (const block of lesson.blocks ?? []) {
      if (block.blockType === 'courseBudget') requireUnique(block.categories.map(category => category.categoryId), 'budget categories')
      if (block.blockType === 'courseQuestion') requireUnique((block.choices ?? []).map(choice => choice.choiceId), 'question choices')
    }
  }
}

export const normalizeCourseAuthoringIds: CollectionBeforeValidateHook<Course> = ({ data, originalDoc }) => {
  if (!data) return data
  const normalized = data.lessons ? { ...data, lessons: normalizeCourseRowIds(data.lessons, originalDoc?.lessons) } : data
  if ((normalized._status ?? originalDoc?._status) === 'published') validateCourseRowIds(normalized.lessons ?? originalDoc?.lessons ?? [])
  return normalized
}
