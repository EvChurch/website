import { describe, expect, it, vi } from 'vitest'
import { normalizeCourseRowIds, validateCourseRowIds } from './authoring'
import type { CourseLesson } from './model'
import type { Course } from '@/payload-types'
import { publishCourseEdition } from './publishing'

const lesson: CourseLesson = { id: 'lesson-row', lessonId: 'lesson-stable', title: 'Lesson', blocks: [
  { id: 'question-row', blockType: 'courseQuestion', prompt: 'Continue?', visibility: 'personal', inputType: 'choice', choices: [
    { id: 'choice-row', choiceId: 'yes', label: 'Yes' },
  ] },
  { id: 'budget-row', blockType: 'courseBudget', title: 'Budget', visibility: 'personal', categories: [
    { id: 'category-row', categoryId: 'living', label: 'Living' },
  ] },
] }

describe('course authoring row identities', () => {
  it('normalizes copied rows even when they appear before the existing row', () => {
    const copiedLesson = structuredClone(lesson)
    copiedLesson.id = 'copied-lesson-row'
    const question = structuredClone(lesson.blocks![0])
    const budget = structuredClone(lesson.blocks![1])
    if (question.blockType !== 'courseQuestion' || budget.blockType !== 'courseBudget') throw new Error('Invalid fixture')
    question.choices!.unshift({ ...question.choices![0], id: 'copied-choice-row' })
    budget.categories.unshift({ ...budget.categories[0], id: 'copied-category-row' })
    const input = [copiedLesson, { ...lesson, blocks: [question, budget] }]
    const original = structuredClone([lesson])
    let sequence = 0
    const normalized = normalizeCourseRowIds(input, original, () => `new-${++sequence}`)

    expect(normalized.map(row => row.lessonId)).toEqual(['new-1', 'lesson-stable'])
    const normalizedQuestion = normalized[1].blocks![0]
    const normalizedBudget = normalized[1].blocks![1]
    if (normalizedQuestion.blockType !== 'courseQuestion' || normalizedBudget.blockType !== 'courseBudget') throw new Error('Invalid fixture')
    expect(normalizedQuestion.choices!.map(row => row.choiceId)).toEqual(['new-2', 'yes'])
    expect(normalizedBudget.categories.map(row => row.categoryId)).toEqual(['new-3', 'living'])
    expect(() => validateCourseRowIds(normalized)).not.toThrow()
    expect(original).toEqual([lesson])
    expect(input[0].lessonId).toBe('lesson-stable')
    expect(question.choices![0].choiceId).toBe('yes')
  })

  it('preserves the custom identities of existing rows even when submitted values change', () => {
    const input = structuredClone(lesson)
    input.lessonId = 'changed'
    const question = input.blocks![0]
    const budget = input.blocks![1]
    if (question.blockType !== 'courseQuestion' || budget.blockType !== 'courseBudget') throw new Error('Invalid fixture')
    question.choices![0].choiceId = 'changed'
    budget.categories[0].categoryId = 'changed'

    expect(normalizeCourseRowIds([input], [lesson])).toEqual([lesson])
  })

  it('allocates unique IDs for duplicated rows on a new course', () => {
    const normalized = normalizeCourseRowIds([lesson, { ...lesson, id: 'new-row' }])
    expect(normalized[0].lessonId).toBe('lesson-stable')
    expect(normalized[1].lessonId).not.toBe('lesson-stable')
  })

  it('rejects duplicate identities that cannot be repaired without changing existing rows', () => {
    const duplicateLessons = [lesson, { ...lesson, id: 'second-existing-row' }]
    const normalized = normalizeCourseRowIds(duplicateLessons, duplicateLessons)
    expect(() => validateCourseRowIds(normalized)).toThrow('lessons must have unique IDs')
    const input = structuredClone(lesson)
    const question = input.blocks![0]
    const budget = input.blocks![1]
    if (question.blockType !== 'courseQuestion' || budget.blockType !== 'courseBudget') throw new Error('Invalid fixture')
    question.choices!.push({ ...question.choices![0], id: 'second-existing-choice-row' })
    expect(() => validateCourseRowIds([input])).toThrow('question choices must have unique IDs')
    question.choices!.pop()
    budget.categories.push({ ...budget.categories[0], id: 'second-existing-category-row' })
    expect(() => validateCourseRowIds([input])).toThrow('budget categories must have unique IDs')
  })

  it('does not write an edition with ambiguous answer or lesson identities', async () => {
    const payload = { find: vi.fn(), update: vi.fn(), create: vi.fn() }
    const doc = { id: 1, title: 'Course', slug: 'course', summary: '', _status: 'published', lessons: [lesson, lesson] } as Course
    await expect(publishCourseEdition({ doc, req: { payload } } as unknown as Parameters<typeof publishCourseEdition>[0])).rejects.toThrow('lessons must have unique IDs')
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})
