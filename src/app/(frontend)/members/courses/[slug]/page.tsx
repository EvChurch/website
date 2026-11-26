import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findPublishedCourse, latestCourseEdition } from '@/lib/courses/service'
import { readCourseSnapshot } from '@/lib/courses/model'
import { startCourseAction } from '../actions'

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await findPublishedCourse(slug)
  if (!course) notFound()
  const edition = await latestCourseEdition(course.id)
  if (!edition) notFound()
  const snapshot = readCourseSnapshot(edition.snapshot)
  return <div className="mx-auto max-w-3xl"><Link href="/members/courses" className="text-sm text-mid-grey">← Courses</Link><h1 className="mt-8 text-4xl sm:text-5xl">{snapshot.title}</h1><p className="mt-4 text-lg text-mid-grey">{snapshot.summary}</p><h2 className="mb-4 mt-10 text-2xl">Lessons</h2><ol className="divide-y divide-warm-grey">{snapshot.lessons.map((lesson, i) => <li key={lesson.lessonId} className="flex gap-4 py-5"><span className="font-bold text-rich-red">{i + 1}</span><span>{lesson.title}</span></li>)}</ol>{course.enrolmentOpen && course.allowSolo !== false ? <form action={startCourseAction} className="mt-8"><input type="hidden" name="slug" value={slug} /><button className="rounded-md bg-rich-red px-6 py-3 font-bold text-white">Start solo →</button></form> : <p className="mt-8 text-mid-grey">Enrolment is closed.</p>}</div>
}
