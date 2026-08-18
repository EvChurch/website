import { describe, expect, it } from 'vitest'

import { ConnectGroupComments } from './ConnectGroupComments'

describe('ConnectGroupComments collection', () => {
  it('is hidden from Payload admin and denies request-scoped access', () => {
    expect(ConnectGroupComments.admin).toMatchObject({
      hidden: true,
      useAsTitle: 'authorName',
    })

    const access = ConnectGroupComments.access

    expect(typeof access?.read === 'function' && access.read({} as never)).toBe(false)
    expect(typeof access?.create === 'function' && access.create({} as never)).toBe(false)
    expect(typeof access?.update === 'function' && access.update({} as never)).toBe(false)
    expect(typeof access?.delete === 'function' && access.delete({} as never)).toBe(false)
  })

  it('stores the group, author, bounded comment body, and visibility contract', () => {
    const fields = new Map(
      ConnectGroupComments.fields
        .filter((field) => 'name' in field)
        .map((field) => [field.name, field]),
    )

    expect(fields.get('rockGroupId')).toMatchObject({
      type: 'number',
      required: true,
      index: true,
    })
    expect(fields.get('authorRockPersonId')).toMatchObject({
      type: 'number',
      required: true,
      index: true,
    })
    expect(fields.get('authorName')).toMatchObject({ type: 'text', required: true })
    expect(fields.get('body')).toMatchObject({
      type: 'textarea',
      required: true,
      maxLength: 4000,
    })
    expect(fields.get('deletedAt')).toMatchObject({ type: 'date', index: true })
    expect(fields.get('deletedByRockPersonId')).toMatchObject({ type: 'number', index: true })
    expect(fields.get('deletedByName')).toMatchObject({ type: 'text' })
    expect(fields.get('visibility')).toMatchObject({
      type: 'select',
      required: true,
      defaultValue: 'leaders-and-coaches',
      options: [
        { label: 'Leaders and coaches', value: 'leaders-and-coaches' },
        { label: 'Coaches only', value: 'coaches-only' },
      ],
    })
  })
})
