'use server'
import { redirect } from 'next/navigation'
import { getCurrentCourseIdentity } from '@/auth/course-session'
import { completeCourseLesson, getOwnedCourseAttempt, startSoloCourse } from '@/lib/courses/service'

export async function startCourseAction(form: FormData) {
  const slug = String(form.get('slug') ?? '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid course.')
  const identity = await getCurrentCourseIdentity()
  if (!identity) redirect(`/auth/login?returnTo=${encodeURIComponent(`/members/courses/${slug}`)}`)
  const attempt = await startSoloCourse(identity, slug)
  const owned = await getOwnedCourseAttempt(identity, attempt.id)
  const first = owned?.snapshot.lessons.find(lesson => !owned.completed.includes(lesson.lessonId)) ?? owned?.snapshot.lessons[0]
  redirect(first ? `/members/courses/attempts/${attempt.id}/${first.lessonId}` : '/members/courses')
}

export async function completeLessonAction(form: FormData) {
  const attemptId = Number(form.get('attemptId')), lessonId = String(form.get('lessonId') ?? '')
  const identity = await getCurrentCourseIdentity()
  if (!identity) redirect('/auth/login?returnTo=%2Fmembers%2Fcourses')
  await completeCourseLesson(identity, attemptId, lessonId)
  const owned = await getOwnedCourseAttempt(identity, attemptId)
  const next = owned?.snapshot.lessons.find(lesson => !owned.completed.includes(lesson.lessonId))
  redirect(next ? `/members/courses/attempts/${attemptId}/${next.lessonId}` : '/members/courses')
}
