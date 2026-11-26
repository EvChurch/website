import type { CollectionAfterChangeHook } from 'payload'
import type { Course, CourseEdition } from '@/payload-types'
import { courseStructureKey, snapshotCourse } from './model'
import { validateCourseRowIds } from './authoring'

export const publishCourseEdition: CollectionAfterChangeHook<Course> = async ({ doc, req }) => {
  if (doc._status !== 'published') return doc
  const snapshot = snapshotCourse(doc)
  validateCourseRowIds(snapshot.lessons)
  const structureKey = courseStructureKey(snapshot)
  const existing = await req.payload.find({ collection: 'course-editions', where: { course: { equals: doc.id } }, sort: '-id', limit: 1, depth: 0, req, overrideAccess: true })
  const latest = existing.docs[0]
  const data = { structureKey, snapshot: JSON.parse(JSON.stringify(snapshot)) as CourseEdition['snapshot'] }
  if (latest?.structureKey === structureKey) {
    await req.payload.update({ collection: 'course-editions', id: latest.id, data, req, overrideAccess: true })
  } else {
    await req.payload.create({ collection: 'course-editions', data: { ...data, course: doc.id, publishedAt: new Date().toISOString() }, req, overrideAccess: true })
  }
  return doc
}
