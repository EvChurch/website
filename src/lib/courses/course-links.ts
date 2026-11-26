import { getPayloadClient } from '@/lib/payload'

/** Optional public entry: never advertise a draft or a closed course. */
export async function faithfulWithMoneyLink() {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'courses',
      where: { and: [{ slug: { equals: 'faithful-with-money' } }, { _status: { equals: 'published' } }, { enrolmentOpen: { equals: true } }] },
      select: { title: true, slug: true }, depth: 0, limit: 1, overrideAccess: true,
    })
    const course = result.docs[0]
    if (!course) return null
    const editions = await payload.count({ collection: 'course-editions', where: { course: { equals: course.id } }, overrideAccess: true })
    return editions.totalDocs ? { title: course.title, href: `/members/courses/${course.slug}` } : null
  } catch (error) {
    console.error('Unable to check optional Faithful with Money course link', error)
    return null
  }
}
