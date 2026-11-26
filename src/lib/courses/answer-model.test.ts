import { describe, expect, it } from 'vitest'
import { courseAnswerComplete, validateCourseAnswer, type CourseQuestion } from './answer-model'
import { courseStructureKey, type CourseSnapshot } from './model'
const question: CourseQuestion = { id: 'q1', blockType: 'courseQuestion', prompt: 'Reflect', inputType: 'text', visibility: 'personal', responseMode: 'group', required: false }
const snapshot = (block: CourseQuestion): CourseSnapshot => ({ title: 'Course', slug: 'course', summary: '', allowSolo: true, allowGroup: true, lessons: [{ lessonId: 'l1', title: 'Lesson', blocks: [block] }] })
describe('course answer validation', () => {
  it('accepts clearing but rejects objects and oversized text', () => {
    expect(validateCourseAnswer(question, '')).toBeNull()
    expect(validateCourseAnswer(question, 'Private reflection')).toBe('Private reflection')
    expect(() => validateCourseAnswer(question, { text: 'injected' })).toThrow()
    expect(() => validateCourseAnswer(question, 'x'.repeat(10001))).toThrow()
  })
  it('accepts zero and rejects invalid numbers', () => {
    const block = { ...question, inputType: 'number' as const }
    expect(validateCourseAnswer(block, 0)).toBe(0)
    expect(courseAnswerComplete(block, 0)).toBe(true)
    expect(() => validateCourseAnswer(block, Infinity)).toThrow()
  })
  it('accepts only configured choices and requires all checklist items', () => {
    const block = { ...question, inputType: 'checklist' as const, choices: [{ choiceId: 'one', label: 'First' }, { choiceId: 'two', label: 'Second' }] }
    expect(() => validateCourseAnswer(block, ['unknown'])).toThrow()
    expect(courseAnswerComplete(block, ['one'])).toBe(false)
    expect(courseAnswerComplete(block, ['one', 'two'])).toBe(true)
  })
  it('requires non-whitespace text', () => expect(courseAnswerComplete(question, '  ')).toBe(false))
})
describe('question edition boundaries', () => {
  it('creates a new edition when the question prompt changes', () => expect(courseStructureKey(snapshot({ ...question, prompt: 'Different question' }))).not.toBe(courseStructureKey(snapshot(question))))
  it('creates a new edition when a saved choice changes meaning', () => {
    const block = { ...question, inputType: 'choice' as const, choices: [{ choiceId: 'one', label: 'Yes' }] }
    expect(courseStructureKey(snapshot({ ...block, choices: [{ choiceId: 'one', label: 'No' }] }))).not.toBe(courseStructureKey(snapshot(block)))
  })
  it.each([{ visibility: 'shared' as const }, { required: true }, { inputType: 'number' as const }, { responseMode: 'individual' as const }])('creates a new edition for changed response semantics %j', change => expect(courseStructureKey(snapshot({ ...question, ...change }))).not.toBe(courseStructureKey(snapshot(question))))
})
