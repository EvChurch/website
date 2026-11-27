import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentCourseIdentity } from '@/auth/course-session'
import { getOwnedCourseAttempt } from '@/lib/courses/service'
import { getCourseLessonAnswers, requiredCourseAnswersComplete } from '@/lib/courses/answers'
import { CourseContent } from '@/components/courses/CourseContent'
import { GuidedLesson } from '@/components/courses/GuidedLesson'
import { canAccessCourseLesson, currentCourseLesson, lessonPosition, lessonSteps } from '@/lib/courses/lesson-flow'
import { courseAnswerComplete, isAnswerableBlock } from '@/lib/courses/answer-model'
import { completeLessonAction } from '../../../actions'

export default async function LessonPage({ params }: { params: Promise<{ attemptId: string; lessonId: string }> }) {
  const { attemptId, lessonId } = await params
  const identity = await getCurrentCourseIdentity()
  if (!identity) redirect(`/auth/login?returnTo=${encodeURIComponent(`/members/courses/attempts/${attemptId}/${lessonId}`)}`)
  const owned = await getOwnedCourseAttempt(identity, Number(attemptId))
  const lesson = owned?.snapshot.lessons.find(lesson => lesson.lessonId === lessonId)
  if (!owned || !lesson) notFound()
  if (!canAccessCourseLesson(owned.snapshot, owned.completed, lessonId)) {
    const current = currentCourseLesson(owned.snapshot, owned.completed)
    redirect(current ? `/members/courses/attempts/${attemptId}/${current.lessonId}` : '/members/courses')
  }
  const [answers, canComplete] = await Promise.all([getCourseLessonAnswers(identity, Number(attemptId), lessonId), requiredCourseAnswersComplete(identity, Number(attemptId), lessonId)])
  const readOnly = owned.attempt.mode === 'group' && (owned.attempt.membershipStatus !== 'active' || Object.values(answers).some(answer => answer.readOnly))
  const steps = await Promise.all(lessonSteps(lesson, owned.attempt.mode).map(async step => ({
    id: step.id, title: step.title,
    blockIds: step.blocks.flatMap(block => block.id ? [block.id] : []),
    requiredComplete: step.blocks.filter(isAnswerableBlock).filter(block => block.required).every(block => courseAnswerComplete(block, answers[block.id!]?.value ?? null)),
    content: await CourseContent({ blocks: step.blocks, attemptId: Number(attemptId), lessonId, answers, mode: owned.attempt.mode }),
  })))
  return <div className="mx-auto max-w-3xl">
    <Link rel="nofollow" href="/members/courses" className="text-sm text-mid-grey">← Courses</Link>
    <nav aria-label="Lessons" className="my-8 flex gap-3 overflow-x-auto border-b border-warm-grey pb-4">
      {owned.snapshot.lessons.map((item, i) => canAccessCourseLesson(owned.snapshot, owned.completed, item.lessonId)
        ? <Link rel="nofollow" key={item.lessonId} aria-current={item.lessonId === lessonId ? 'page' : undefined} href={`/members/courses/attempts/${attemptId}/${item.lessonId}`} className={`shrink-0 rounded-md px-3 py-2 text-sm font-bold ${item.lessonId === lessonId ? 'bg-white text-rich-red' : 'text-mid-grey'}`}>{owned.completed.includes(item.lessonId) ? '✓' : i + 1} {item.title}</Link>
        : <span key={item.lessonId} aria-disabled="true" className="shrink-0 px-3 py-2 text-sm text-mid-grey">{i + 1} {item.title} · Locked</span>)}
    </nav>
    {owned.attempt.mode === 'group' && owned.attempt.membershipStatus === 'active' && <Link rel="nofollow" className="mb-5 inline-block text-sm text-rich-red underline" href={`/members/courses/groups/${typeof owned.attempt.group === 'number' ? owned.attempt.group : owned.attempt.group?.id}`}>Your group</Link>}
    <p className="text-xs font-bold uppercase tracking-widest text-rich-red">Lesson {owned.snapshot.lessons.indexOf(lesson) + 1} of {owned.snapshot.lessons.length}</p>
    <h1 className="mb-8 mt-3 text-4xl">{lesson.title}</h1>
    {owned.attempt.mode === 'group' && owned.attempt.membershipStatus !== 'active' && <p className="mb-6 text-sm text-mid-grey">Group access has ended. Your personal answers remain.</p>}
    {Object.values(answers).some(answer => answer.readOnly) && <p className="mb-6 text-sm text-mid-grey">This group is closed. Answers are read only.</p>}
    <GuidedLesson key={`${attemptId}:${lessonId}`} attemptId={Number(attemptId)} lessonId={lessonId} steps={steps} initialStepId={lessonPosition(lesson, owned.attempt.lessonPositions)} readOnly={readOnly}
      completion={<form action={completeLessonAction}><input type="hidden" name="attemptId" value={attemptId} /><input type="hidden" name="lessonId" value={lessonId} /><button disabled={!canComplete} className="rounded-md bg-rich-red px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{owned.completed.includes(lessonId) ? 'Continue' : 'Finish lesson'} →</button>{!canComplete && <p className="mt-3 text-sm text-mid-grey">{readOnly ? 'Lesson completion is unavailable.' : 'Complete the required questions first.'}</p>}</form>} />
  </div>
}
