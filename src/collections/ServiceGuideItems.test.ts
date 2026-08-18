import { describe, expect, it } from 'vitest'

import { ServiceGuideItems } from './ServiceGuideItems'

describe('ServiceGuideItems collection', () => {
  it('is grouped with the other launcher models', () => {
    expect(ServiceGuideItems.admin).toMatchObject({ group: 'Launcher' })
  })

  it('allows administrative reads and denies request-scoped mutations', () => {
    const read = ServiceGuideItems.access?.read
    const create = ServiceGuideItems.access?.create
    const update = ServiceGuideItems.access?.update
    const remove = ServiceGuideItems.access?.delete

    expect(typeof read).toBe('function')
    expect(
      typeof read === 'function' &&
        read({ req: { user: { roles: ['editor'] } } } as unknown as Parameters<typeof read>[0]),
    ).toBe(true)
    expect(
      typeof read === 'function' &&
        read({ req: { user: null } } as unknown as Parameters<typeof read>[0]),
    ).toBe(false)
    expect(typeof create === 'function' && create({} as never)).toBe(false)
    expect(typeof update === 'function' && update({} as never)).toBe(false)
    expect(typeof remove === 'function' && remove({} as never)).toBe(false)
  })

  it('uses an indexed durable Rock ID and the expected launcher field contract', () => {
    const fields = new Map(
      ServiceGuideItems.fields
        .filter((field) => 'name' in field)
        .map((field) => [field.name, field]),
    )

    expect(fields.get('rockId')).toMatchObject({
      type: 'number',
      required: true,
      unique: true,
      index: true,
    })
    expect([...fields.keys()]).toEqual(
      expect.arrayContaining([
        'title',
        'content',
        'promotionalBlurb',
        'status',
        'startDateTime',
        'expireDateTime',
        'priority',
        'sourceOrder',
        'campuses',
        'directLink',
        'workflowGuid',
        'connectionOpportunityGuid',
        'connectionBlockGuid',
        'event',
        'lastSyncedAt',
      ]),
    )
  })
})
