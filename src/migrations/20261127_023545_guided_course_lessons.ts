import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { enrichFaithfulIndividualCopy } from '../../content/courses/faithful-individual-copy'
import { courseStructureKey, readCourseSnapshot } from '../lib/courses/model'
import { up as publishInitialFaithfulCourse } from './20261126_180000_publish_faithful_course'

/** Frozen exact-match copy repair; no mutable course template is imported here. */
export async function enrichExistingFaithfulCourse({ payload, req }: Pick<MigrateUpArgs, 'payload' | 'req'>): Promise<void> {
  const originalContext = { ...req.context }
  try {
  const latest = await payload.find({ collection: 'courses', where: { slug: { equals: 'faithful-with-money' } }, draft: true, depth: 0, limit: 1, overrideAccess: true, req })
  const draft = latest.docs[0]
  if (!draft) return
  const published = await payload.find({ collection: 'courses', where: { and: [{ id: { equals: draft.id } }, { _status: { equals: 'published' } }] }, draft: false, depth: 0, limit: 1, overrideAccess: true, req })
  const current = published.docs[0]
  let publishedChanged = false
  if (current) {
    const copy = enrichFaithfulIndividualCopy(current.lessons)
    if (copy.changed) {
      await payload.update({ collection: 'courses', id: current.id, data: { lessons: copy.lessons, _status: 'published' }, draft: false, context: { skipCourseEditionRefresh: true }, overrideAccess: true, req })
      publishedChanged = true
    }
  }
  // Re-save any pre-existing draft after the published repair so it stays the
  // latest draft, including human edits to title, settings and lesson content.
  if (draft._status === 'draft') {
    const copy = enrichFaithfulIndividualCopy(draft.lessons)
    if (copy.changed || publishedChanged) await payload.update({
      collection: 'courses', id: draft.id, draft: true, overrideAccess: true, req,
      context: { skipCourseEditionRefresh: true },
      data: { title: draft.title, slug: draft.slug, summary: draft.summary,
        enrolmentOpen: draft.enrolmentOpen, allowSolo: draft.allowSolo, allowGroup: draft.allowGroup,
        lessons: copy.lessons, _status: 'draft' },
    })
  }
  let page = 1
  for (;;) {
    const editions = await payload.find({ collection: 'course-editions', where: { course: { equals: draft.id } }, depth: 0, limit: 100, page, overrideAccess: true, req })
    for (const edition of editions.docs) {
      const snapshot = readCourseSnapshot(edition.snapshot)
      const copy = enrichFaithfulIndividualCopy(snapshot.lessons)
      const next = { ...snapshot, lessons: copy.lessons }
      const structureKey = courseStructureKey(next)
      if (copy.changed || structureKey !== edition.structureKey) await payload.update({ collection: 'course-editions', id: edition.id,
        data: { snapshot: JSON.parse(JSON.stringify(next)), structureKey }, overrideAccess: true, req })
    }
    if (!editions.hasNextPage) break
    page++
  }
  } finally { req.context = originalContext }
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_blocks_course_question" ADD COLUMN "individual_prompt" varchar;
  ALTER TABLE "courses_blocks_course_question" ADD COLUMN "individual_guidance" varchar;
  ALTER TABLE "courses_blocks_course_teaching" ADD COLUMN "individual_body" jsonb;
  ALTER TABLE "_courses_v_blocks_course_question" ADD COLUMN "individual_prompt" varchar;
  ALTER TABLE "_courses_v_blocks_course_question" ADD COLUMN "individual_guidance" varchar;
  ALTER TABLE "_courses_v_blocks_course_teaching" ADD COLUMN "individual_body" jsonb;
  ALTER TABLE "course_attempts" ADD COLUMN "lesson_positions" jsonb DEFAULT '{}'::jsonb;`)
  await publishInitialFaithfulCourse({ db, payload, req })
  await enrichExistingFaithfulCourse({ payload, req })
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_blocks_course_question" DROP COLUMN "individual_prompt";
  ALTER TABLE "courses_blocks_course_question" DROP COLUMN "individual_guidance";
  ALTER TABLE "courses_blocks_course_teaching" DROP COLUMN "individual_body";
  ALTER TABLE "_courses_v_blocks_course_question" DROP COLUMN "individual_prompt";
  ALTER TABLE "_courses_v_blocks_course_question" DROP COLUMN "individual_guidance";
  ALTER TABLE "_courses_v_blocks_course_teaching" DROP COLUMN "individual_body";
  ALTER TABLE "course_attempts" DROP COLUMN "lesson_positions";`)
}
