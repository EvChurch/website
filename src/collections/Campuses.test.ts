import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invalidate: vi.fn() }))
vi.mock('@/hooks/revalidateCacheTags', () => ({ createCacheInvalidationHook: () => mocks.invalidate }))

import { Campuses } from './Campuses'

type FieldRecord = {
  name?: string
  fields?: FieldRecord[]
  validate?: (
    value: unknown,
    options: { siblingData: Record<string, unknown> },
  ) => string | true | Promise<string | true>
}

function field(name: string): FieldRecord {
  const pageContent = (Campuses.fields as FieldRecord[]).find(
    (candidate) => candidate.name === 'pageContent',
  )
  const result = pageContent?.fields?.find((candidate) => candidate.name === name)
  if (!result) throw new Error(`Missing campus page field: ${name}`)
  return result
}

describe('Campuses service calendar validation', () => {
  it('accepts only exact weekday names', async () => {
    const validate = field('serviceDay').validate

    await expect(
      Promise.resolve(validate?.('Sunday', { siblingData: {} })),
    ).resolves.toBe(true)
    await expect(
      Promise.resolve(validate?.('Sundays', { siblingData: {} })),
    ).resolves.toContain('weekday')
  })

  it('prevents an end time at or before the start time', async () => {
    const validate = field('serviceCloses').validate

    await expect(
      Promise.resolve(validate?.('11:30', { siblingData: { serviceOpens: '10:15' } })),
    ).resolves.toBe(true)
    await expect(
      Promise.resolve(validate?.('10:15', { siblingData: { serviceOpens: '10:15' } })),
    ).resolves.toContain('after')
    await expect(
      Promise.resolve(validate?.('09:45', { siblingData: { serviceOpens: '10:15' } })),
    ).resolves.toContain('after')
  })
})


describe('campus block cache invalidation', () => {
  beforeEach(() => mocks.invalidate.mockClear())
  const afterChange = Campuses.hooks!.afterChange![0]

  it('invalidates when a block schedule changes or the final block is removed', async () => {
    const layout = [{ blockType: 'upcomingEvents', visibility: { until: '2026-12-27T11:00:00Z' } }]
    await afterChange({ doc: { layout }, previousDoc: { layout: [] }, context: {} } as never)
    expect(mocks.invalidate).toHaveBeenCalledOnce()
    await afterChange({ doc: { layout: [] }, previousDoc: { layout }, context: {} } as never)
    expect(mocks.invalidate).toHaveBeenCalledTimes(2)
  })

  it('leaves unchanged layouts and ordinary Rock sync updates alone', async () => {
    await afterChange({ doc: {}, previousDoc: {}, context: {} } as never)
    const layout = [{ blockType: 'upcomingEvents' }]
    await afterChange({ doc: { layout }, previousDoc: { layout }, context: {} } as never)
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
})
