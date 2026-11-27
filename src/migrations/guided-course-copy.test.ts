import { describe, expect, it, vi } from 'vitest'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'
import { faithfulWithMoneyCourse } from '../../content/courses/faithful-with-money'
import { courseStructureKey, snapshotCourse } from '../lib/courses/model'
import type { Course } from '../payload-types'
import { enrichExistingFaithfulCourse } from './20261127_023545_guided_course_lessons'

function originalCourse(): Course {
  const course = structuredClone({ ...faithfulWithMoneyCourse, id: 99, createdAt: '', updatedAt: '', _status: 'published' }) as Course
  const intro = course.lessons[0].blocks![0]
  if (intro.blockType !== 'courseTeaching') throw new Error('Wrong fixture')
  delete intro.individualBody
  return course
}
function fixture() {
  const find = vi.fn(), update = vi.fn().mockImplementation(async (options) => { Object.assign(options.req.context, options.context); return {} })
  const req = { context: { existing: true } } as unknown as MigrateUpArgs['req']
  return { find, update, req, args: { payload: { find, update } as unknown as MigrateUpArgs['payload'], req } }
}

describe('guided course copy migration', () => {
  it('repairs known content and existing editions while retaining an editor draft and IDs', async () => {
    const { find, update, req, args } = fixture()
    const current = originalCourse()
    const draft = { ...structuredClone(current), _status: 'draft', title: 'Editor draft title', enrolmentOpen: false }
    const snapshot = snapshotCourse(current)
    find.mockResolvedValueOnce({ docs: [draft] }).mockResolvedValueOnce({ docs: [current] }).mockResolvedValueOnce({ docs: [{ id: 88, snapshot, structureKey: 'old-key' }], hasNextPage: false })
    await enrichExistingFaithfulCourse(args)
    expect(update).toHaveBeenCalledTimes(3)
    expect(update.mock.calls[0][0]).toMatchObject({ collection: 'courses', id: 99, draft: false, data: { _status: 'published' }, context: { skipCourseEditionRefresh: true } })
    expect(update.mock.calls[1][0]).toMatchObject({ collection: 'courses', id: 99, draft: true, data: { title: 'Editor draft title', enrolmentOpen: false, _status: 'draft' } })
    const editionUpdate = update.mock.calls[2][0]
    expect(editionUpdate).toMatchObject({ collection: 'course-editions', id: 88 })
    expect(editionUpdate.data.snapshot.lessons.map((lesson: Course['lessons'][number]) => lesson.lessonId)).toEqual(snapshot.lessons.map(lesson => lesson.lessonId))
    expect(editionUpdate.data.structureKey).toBe(courseStructureKey(editionUpdate.data.snapshot))
    expect(req.context).toEqual({ existing: true })
  })
  it('does nothing when the course is absent', async () => {
    const { find, update, args } = fixture()
    find.mockResolvedValue({ docs: [] })
    await enrichExistingFaithfulCourse(args)
    expect(update).not.toHaveBeenCalled()
  })
  it('restores internal request context after a failed repair', async () => {
    const { find, update, req, args } = fixture()
    const current = originalCourse()
    find.mockResolvedValue({ docs: [current] })
    update.mockImplementation(async options => { Object.assign(options.req.context, options.context); throw new Error('write failed') })
    await expect(enrichExistingFaithfulCourse(args)).rejects.toThrow('write failed')
    expect(req.context).toEqual({ existing: true })
  })
})
