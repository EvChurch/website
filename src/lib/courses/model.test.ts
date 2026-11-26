import { describe, expect, it } from 'vitest'
import { courseStructureKey, isCourseComplete, type CourseSnapshot } from './model'

const course: CourseSnapshot = { title: 'Sample', slug: 'sample', summary: 'Learn together', allowSolo: true, allowGroup: true,
  lessons: [{ lessonId: 'one', title: 'First', required: true, blocks: [{ id: 'words', blockType: 'courseTeaching', body: { root: { type: 'root', version: 1, children: [], direction: null, format: '', indent: 0 } } }] }, { lessonId: 'two', title: 'Optional', required: false }] }

describe('course edition boundaries', () => {
  it('keeps wording corrections in the same structural edition', () => {
    expect(courseStructureKey({ ...course, title: 'Corrected', lessons: [{ ...course.lessons[0], title: 'Corrected lesson' }, course.lessons[1]] })).toBe(courseStructureKey(course))
  })
  it('creates a new boundary for reordered lessons or changed requirements', () => {
    expect(courseStructureKey({ ...course, lessons: [...course.lessons].reverse() })).not.toBe(courseStructureKey(course))
    expect(courseStructureKey({ ...course, lessons: [{ ...course.lessons[0], required: false }] })).not.toBe(courseStructureKey(course))
  })
  it('requires only required lessons for completion', () => {
    expect(isCourseComplete(course, [])).toBe(false)
    expect(isCourseComplete(course, ['one'])).toBe(true)
  })
})
