import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentCourseIdentity } from '@/auth/course-session'
import { getOwnedCourseAttempt } from '@/lib/courses/service'
import { getCourseLessonAnswers, requiredCourseAnswersComplete } from '@/lib/courses/answers'
import { CourseContent } from '@/components/courses/CourseContent'
import { completeLessonAction } from '../../../actions'

export default async function LessonPage({ params }: { params: Promise<{ attemptId: string; lessonId: string }> }) {
  const { attemptId, lessonId } = await params
  const identity = await getCurrentCourseIdentity()
  if (!identity) redirect(`/auth/login?returnTo=${encodeURIComponent(`/members/courses/attempts/${attemptId}/${lessonId}`)}`)
  const owned = await getOwnedCourseAttempt(identity, Number(attemptId))
  const lesson = owned?.snapshot.lessons.find(lesson => lesson.lessonId === lessonId)
  if (!owned || !lesson) notFound()
  const [answers, canComplete] = await Promise.all([getCourseLessonAnswers(identity, Number(attemptId), lessonId), requiredCourseAnswersComplete(identity, Number(attemptId), lessonId)])
  return <div className="mx-auto max-w-3xl"><Link href="/members/courses" className="text-sm text-mid-grey">← Courses</Link><nav aria-label="Lessons" className="my-8 flex gap-3 overflow-x-auto border-b border-warm-grey pb-4">{owned.snapshot.lessons.map((item, i) => <Link key={item.lessonId} aria-current={item.lessonId === lessonId ? 'page' : undefined} href={`/members/courses/attempts/${attemptId}/${item.lessonId}`} className={`shrink-0 rounded-md px-3 py-2 text-sm font-bold ${item.lessonId === lessonId ? 'bg-white text-rich-red' : 'text-mid-grey'}`}>{owned.completed.includes(item.lessonId) ? '✓' : i + 1} {item.title}</Link>)}</nav><p className="text-xs font-bold uppercase tracking-widest text-rich-red">Lesson {owned.snapshot.lessons.indexOf(lesson) + 1} of {owned.snapshot.lessons.length}</p><h1 className="mb-8 mt-3 text-4xl">{lesson.title}</h1><CourseContent blocks={lesson.blocks ?? []} attemptId={Number(attemptId)} lessonId={lessonId} answers={answers} /><form action={completeLessonAction} className="mt-12 border-t border-warm-grey pt-6"><input type="hidden" name="attemptId" value={attemptId} /><input type="hidden" name="lessonId" value={lessonId} /><button disabled={!canComplete} className="w-full rounded-md bg-rich-red px-6 py-3 font-bold text-white disabled:opacity-50">{owned.completed.includes(lessonId) ? 'Continue' : 'Mark lesson complete'} →</button>{!canComplete && <p className="mt-3 text-sm text-mid-grey">Complete the required questions first.</p>}</form></div>
}
