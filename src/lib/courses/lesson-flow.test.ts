import { describe, expect, it } from 'vitest'
import { canAccessCourseLesson, courseDisplayBlock, lessonPosition, lessonSteps } from './lesson-flow'
import { faithfulWithMoneyCourse } from '../../../content/courses/faithful-with-money'
import type { CourseSnapshot } from './model'

describe('guided lesson flow', () => {
  it('keeps every block in order while showing one activity at a time', () => {
    for (const lesson of faithfulWithMoneyCourse.lessons) {
      const steps = lessonSteps(lesson)
      expect(steps.length).toBeGreaterThan(1)
      expect(steps.flatMap(step => step.blocks.map(block => block.id))).toEqual((lesson.blocks ?? []).map(block => block.id))
      expect(new Set(steps.map(step => step.id)).size).toBe(steps.length)
      expect(lessonSteps(lesson, 'solo').map(step => step.id)).toEqual(steps.map(step => step.id))
      for (const step of steps) expect(step.blocks.filter(block => ['courseQuestion', 'coursePrompt', 'courseBudget', 'courseVideo'].includes(block.blockType)).length).toBeLessThanOrEqual(1)
      for (const step of steps) {
        const exercise = step.blocks.find(block => block.blockType === 'courseBudget')
        if (exercise?.blockType === 'courseBudget') expect(step.title).toBe(exercise.title)
      }
    }
  })
  it('resumes a stable saved step and tolerates obsolete positions', () => {
    const lesson = faithfulWithMoneyCourse.lessons[0], steps = lessonSteps(lesson)
    expect(lessonPosition(lesson, { [lesson.lessonId]: steps[2].id })).toBe(steps[2].id)
    expect(lessonPosition(lesson, { [lesson.lessonId]: 'removed' })).toBe(steps[0].id)
    expect(lessonPosition(lesson, null)).toBe(steps[0].id)
  })
  it('uses individual copy without changing step identities or group copy', () => {
    const lesson = faithfulWithMoneyCourse.lessons[0]
    const teaching = lesson.blocks?.find(block => block.blockType === 'courseTeaching' && block.individualBody)
    if (!teaching || teaching.blockType !== 'courseTeaching') throw new Error('Missing individual teaching fixture')
    const display = courseDisplayBlock(teaching, 'solo')
    expect(display.blockType === 'courseTeaching' && display.body).toEqual(teaching.individualBody)
    expect(courseDisplayBlock(teaching, 'group')).toBe(teaching)
    expect(lessonSteps(lesson, 'solo').map(step => step.id)).toEqual(lessonSteps(lesson, 'group').map(step => step.id))
    expect(lessonSteps(lesson, 'solo').some(step => /together|each other/i.test(step.title))).toBe(false)
    const question = lesson.blocks?.find(block => block.blockType === 'courseQuestion' && block.individualPrompt)
    if (!question || question.blockType !== 'courseQuestion') throw new Error('Missing individual question fixture')
    const individual = courseDisplayBlock(question, 'solo')
    expect(individual.blockType === 'courseQuestion' && individual.prompt).toBe(question.individualPrompt)
    expect(courseDisplayBlock(question, 'group')).toBe(question)
  })
  it('locks later lessons until all earlier lessons are complete, including legacy gaps', () => {
    const snapshot = faithfulWithMoneyCourse as unknown as CourseSnapshot
    expect(canAccessCourseLesson(snapshot, [], 's1')).toBe(true)
    expect(canAccessCourseLesson(snapshot, [], 's2')).toBe(false)
    expect(canAccessCourseLesson(snapshot, ['s2', 's3'], 's3')).toBe(false)
    expect(canAccessCourseLesson(snapshot, ['s1'], 's2')).toBe(true)
    expect(canAccessCourseLesson(snapshot, ['s1', 's2'], 's1')).toBe(true)
    expect(canAccessCourseLesson(snapshot, ['s1', 's2', 's3'], 'missing')).toBe(false)
  })
})
