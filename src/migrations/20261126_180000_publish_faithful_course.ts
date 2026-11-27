import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'
import { faithfulWithMoneyCourse } from '../../content/courses/faithful-with-money'

// Reviewed CMS content fallback while production Payload MCP is unavailable.
// Never overwrite or publish an existing course, including an editor's draft.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // A fresh database reaches this migration before the optional copy columns.
  // The later schema migration retries this creation after adding those columns.
  const columns = await db.execute(sql`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='courses_blocks_course_teaching' AND column_name='individual_body'
  ) AS present`)
  if (!columns.rows[0]?.present) return
  const existing = await payload.find({
    collection: 'courses', where: { slug: { equals: faithfulWithMoneyCourse.slug } },
    select: { slug: true },
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
