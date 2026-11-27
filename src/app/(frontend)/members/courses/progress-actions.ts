'use server'
import { getCurrentCourseIdentity } from '@/auth/course-session'
import { saveCourseLessonPosition } from '@/lib/courses/service'

export async function updateLessonPositionAction(attemptId: number, lessonId: string, stepId: string): Promise<{ status: 'saved' } | { status: 'error'; message: string }> {
  try {
    const identity = await getCurrentCourseIdentity()
    if (!identity) return { status: 'error', message: 'Sign in to save your place.' }
    await saveCourseLessonPosition(identity, attemptId, lessonId, stepId)
    return { status: 'saved' }
  } catch {
    return { status: 'error', message: 'Couldn’t save your place.' }
  }
}
