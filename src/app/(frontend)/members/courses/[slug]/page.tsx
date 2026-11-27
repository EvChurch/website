import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findPublishedCourse, latestCourseEdition } from '@/lib/courses/service'
import { readCourseSnapshot } from '@/lib/courses/model'
import { startGroupAction } from '../group-actions'
import { startCourseAction } from '../actions'

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await findPublishedCourse(slug)
  if (!course) notFound()
  const edition = await latestCourseEdition(course.id)
  if (!edition) notFound()
  const snapshot = readCourseSnapshot(edition.snapshot)
  return <div className="mx-auto max-w-3xl"><Link rel="nofollow" href="/members/courses" className="text-sm text-mid-grey">← Courses</Link><h1 className="mt-8 text-4xl sm:text-5xl">{snapshot.title}</h1><p className="mt-4 text-lg text-mid-grey">{snapshot.summary}</p><h2 className="mb-4 mt-10 text-2xl">Lessons</h2><ol className="divide-y divide-warm-grey">{snapshot.lessons.map((lesson, i) => <li key={lesson.lessonId} className="flex gap-4 py-5"><span className="font-bold text-rich-red">{i + 1}</span><span>{lesson.title}</span></li>)}</ol>{course.enrolmentOpen && course.allowSolo !== false ? <form action={startCourseAction} className="mt-8"><input type="hidden" name="slug" value={slug} /><button className="rounded-md bg-rich-red px-6 py-3 font-bold text-white">Start course →</button></form> : !course.enrolmentOpen ? <p className="mt-8 text-mid-grey">Enrolment is closed.</p> : null}{course.enrolmentOpen && course.allowGroup !== false && <form action={startGroupAction} className="mt-6 space-y-3 border-t border-warm-grey pt-6"><input type="hidden" name="slug" value={slug} /><label htmlFor="group-name" className="block text-sm font-bold">Start with a group</label><input id="group-name" name="name" maxLength={80} placeholder="Group name" className="w-full rounded-md border border-warm-grey bg-white px-4 py-3" /><button className="rounded-md border border-rich-red px-6 py-3 font-bold text-rich-red">Start group →</button></form>}</div>
}
