import { beforeEach, describe, expect, it, vi } from 'vitest'
const { find, count } = vi.hoisted(() => ({ find: vi.fn(), count: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({ find, count }) }))
import { faithfulWithMoneyLink } from './course-links'

beforeEach(() => vi.resetAllMocks())
describe('calculator course invitation availability', () => {
  it('links a published open course with an enrolment edition', async () => {
    find.mockResolvedValue({ docs: [{ id: 7, title: 'Faithful with Money', slug: 'faithful-with-money' }] })
    count.mockResolvedValue({ totalDocs: 1 })
    expect(await faithfulWithMoneyLink()).toEqual({ title: 'Faithful with Money', href: '/members/courses/faithful-with-money' })
    expect(find.mock.calls[0][0].where.and).toEqual(expect.arrayContaining([{ _status: { equals: 'published' } }, { enrolmentOpen: { equals: true } }]))
  })
  it('does not link an absent draft or closed course excluded by the public filter', async () => {
    find.mockResolvedValue({ docs: [] })
    expect(await faithfulWithMoneyLink()).toBeNull()
    expect(count).not.toHaveBeenCalled()
  })
  it('does not link a published course with no edition', async () => {
    find.mockResolvedValue({ docs: [{ id: 7 }] })
    count.mockResolvedValue({ totalDocs: 0 })
    expect(await faithfulWithMoneyLink()).toBeNull()
  })
  it('keeps the calculator usable if the optional CMS lookup fails', async () => {
    find.mockRejectedValue(new Error('offline'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { expect(await faithfulWithMoneyLink()).toBeNull() } finally { log.mockRestore() }
  })
})
