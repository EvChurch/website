'use server'
import { getCurrentCourseIdentity } from '@/auth/course-session'
import { readCourseAnswer, saveCourseAnswer, readOtherCourseAnswers } from '@/lib/courses/answers'
import type { CourseSaveResult } from '@/lib/courses/answer-model'

export async function readCourseAnswerAction(attemptId: number, lessonId: string, blockId: string) {
  const identity = await getCurrentCourseIdentity()
  if (!identity) throw new Error('Sign in to continue.')
  return readCourseAnswer(identity, attemptId, lessonId, blockId)
}

export async function saveCourseAnswerAction(attemptId: number, lessonId: string, blockId: string, revision: number, value: unknown): Promise<CourseSaveResult> {
  try {
    const identity = await getCurrentCourseIdentity()
    if (!identity) return { status: 'error', message: 'Sign in to save your answer.' }
    return await saveCourseAnswer(identity, attemptId, lessonId, blockId, revision, value)
  } catch {
    return { status: 'error', message: 'Couldn’t save. Your answer is kept here.' }
  }
}

export async function readOtherCourseAnswersAction(attemptId: number, lessonId: string, blockId: string) {
  const identity = await getCurrentCourseIdentity()
  if (!identity) throw new Error('Sign in to continue.')
  return readOtherCourseAnswers(identity, attemptId, lessonId, blockId)
}
