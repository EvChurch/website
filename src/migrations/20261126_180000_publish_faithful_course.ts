import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { faithfulWithMoneyCourse } from '../../content/courses/faithful-with-money'

// Reviewed CMS content fallback while production Payload MCP is unavailable.
// Never overwrite or publish an existing course, including an editor's draft.
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.find({
    collection: 'courses', where: { slug: { equals: faithfulWithMoneyCourse.slug } },
    limit: 1, depth: 0, draft: true, overrideAccess: true, req,
  })
  if (existing.docs.length) return

  const course = await payload.create({
    collection: 'courses',
    data: { ...faithfulWithMoneyCourse, _status: 'published' },
    draft: false, overrideAccess: true, req,
  })
  // The publication hook creates the enrolment edition in this transaction.
  const editions = await payload.find({
    collection: 'course-editions', where: { course: { equals: course.id } },
    limit: 1, depth: 0, overrideAccess: true, req,
  })
  if (!editions.docs.length) throw new Error('Faithful with Money publication did not create a course edition.')
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve the course, subsequent editor changes, and learner work on rollback.
}
