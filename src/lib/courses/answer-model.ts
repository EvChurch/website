import type { CourseBlock } from './model'

export type CourseQuestion = Extract<CourseBlock, { blockType: 'courseQuestion' }>
export type CourseAnswerScope = 'personal' | 'individual-shared' | 'group'
export type CourseAnswerValue = string | number | string[] | null
export interface CourseAnswerState {
  blockId: string
  scope: CourseAnswerScope
  value: CourseAnswerValue
  revision: number
  updatedAt: string | null
}
export type CourseSaveResult =
  | { status: 'saved'; answer: CourseAnswerState }
  | { status: 'conflict'; answer: CourseAnswerState }
  | { status: 'error'; message: string }

export function isQuestionBlock(block: CourseBlock): block is CourseQuestion {
  return block.blockType === 'courseQuestion'
}

export function validateCourseAnswer(block: CourseQuestion, value: unknown): CourseAnswerValue {
  if (value === null || value === '') return null
  switch (block.inputType) {
    case 'text':
      if (typeof value === 'string' && value.length <= 10000) return value
      break
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e15) return value
      break
    case 'choice':
      if (typeof value === 'string' && block.choices?.some(choice => choice.choiceId === value)) return value
      break
    case 'checklist': {
      const allowed = new Set(block.choices?.map(choice => choice.choiceId) ?? [])
      if (Array.isArray(value) && value.length <= allowed.size && value.every(item => typeof item === 'string' && allowed.has(item))) return [...new Set(value)] as string[]
      break
    }
  }
  throw new Error('Check your answer and try again.')
}

export function courseAnswerComplete(block: CourseQuestion, value: CourseAnswerValue): boolean {
  if (value === null) return false
  if (block.inputType === 'checklist') return Array.isArray(value) && !!block.choices?.length && block.choices.every(choice => value.includes(choice.choiceId))
  if (typeof value === 'string') return value.trim().length > 0
  return typeof value === 'number' && Number.isFinite(value)
}
