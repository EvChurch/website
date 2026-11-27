import { describe, expect, it, vi } from 'vitest'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'
import { down, up } from '../migrations/20261126_180000_publish_faithful_course'

function fixture(existing: unknown[] = [], editions: unknown[] = [{ id: 9 }]) {
  const payload = {
    find: vi.fn().mockResolvedValueOnce({ docs: existing }).mockResolvedValueOnce({ docs: editions }),
    create: vi.fn().mockResolvedValue({ id: 4 }),
  }
  const req = { transactionID: 'migration-transaction' }
  const db = { execute: vi.fn().mockResolvedValue({ rows: [{ present: true }] }) }
  return { payload, req, db, args: { payload, req, db } as unknown as MigrateUpArgs }
}

describe('initial Faithful with Money publication', () => {
  it('defers creation on a fresh database until the later copy schema is ready', async () => {
    const f = fixture()
    f.db.execute.mockResolvedValue({ rows: [{ present: false }] })
    await up(f.args)
    expect(f.payload.find).not.toHaveBeenCalled()
    expect(f.payload.create).not.toHaveBeenCalled()
  })
  it('publishes absent reviewed content and verifies its edition in the migration transaction', async () => {
    const f = fixture()
    await up(f.args)
    expect(f.payload.find.mock.calls[0][0]).toMatchObject({ draft: true, req: f.req, where: { slug: { equals: 'faithful-with-money' } } })
    expect(f.payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'courses', draft: false, req: f.req,
      data: expect.objectContaining({ _status: 'published', enrolmentOpen: true, lessons: expect.any(Array) }),
    }))
    expect(f.payload.find.mock.calls[1][0]).toMatchObject({ collection: 'course-editions', req: f.req, where: { course: { equals: 4 } } })
  })
  it.each(['draft', 'published'])('preserves an existing %s course without any write', async status => {
    const f = fixture([{ id: 4, _status: status }])
    await up(f.args)
    expect(f.payload.create).not.toHaveBeenCalled()
    expect(f.payload.find).toHaveBeenCalledTimes(1)
  })
  it('fails the migration if the publication hook produced no edition', async () => {
    await expect(up(fixture([], []).args)).rejects.toThrow('did not create a course edition')
  })
  it('preserves content and learner work on rollback', async () => {
    await expect(down({} as never)).resolves.toBeUndefined()
  })
})
