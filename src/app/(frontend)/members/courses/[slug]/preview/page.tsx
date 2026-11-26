import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { hasEditorialRole } from '@/access/roles'
import { getPayloadClient } from '@/lib/payload'
import { CourseContent } from '@/components/courses/CourseContent'

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'users' || !hasEditorialRole(user)) notFound()
  const { slug } = await params
  const result = await payload.find({ collection: 'courses', where: { slug: { equals: slug } }, draft: true, depth: 0, limit: 1, overrideAccess: false, user })
  const course = result.docs[0]
  if (!course) notFound()
  return <div className="mx-auto max-w-3xl"><p className="mb-4 text-sm font-bold text-rich-red">Preview · Not enrolled</p><h1 className="text-4xl">{course.title}</h1><p className="mt-4 text-mid-grey">{course.summary}</p>{course.lessons?.map(lesson => <section key={lesson.lessonId} className="mt-12"><h2 className="mb-6 text-3xl">{lesson.title}</h2><CourseContent blocks={lesson.blocks ?? []} /></section>)}</div>
}
