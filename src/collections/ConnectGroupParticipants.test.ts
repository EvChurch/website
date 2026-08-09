import { describe, expect, it } from 'vitest'

import { ConnectGroupParticipants } from './ConnectGroupParticipants'

describe('ConnectGroupParticipants collection', () => {
  it('allows only Payload admins to read and denies request-scoped mutations', () => {
    const read = ConnectGroupParticipants.access?.read
    const create = ConnectGroupParticipants.access?.create
    const update = ConnectGroupParticipants.access?.update
    const remove = ConnectGroupParticipants.access?.delete

    expect(
      typeof read === 'function' &&
        read({ req: { user: { roles: ['editor'] } } } as unknown as Parameters<typeof read>[0]),
    ).toBe(false)
    expect(
      typeof read === 'function' &&
        read({ req: { user: { roles: ['admin'] } } } as unknown as Parameters<typeof read>[0]),
    ).toBe(true)
    expect(
      typeof read === 'function' &&
        read({ req: { user: null } } as unknown as Parameters<typeof read>[0]),
    ).toBe(false)
    expect(typeof create === 'function' && create({} as never)).toBe(false)
    expect(typeof update === 'function' && update({} as never)).toBe(false)
    expect(typeof remove === 'function' && remove({} as never)).toBe(false)
  })

  it('stores a durable Rock person identity and normalized active memberships', () => {
    const fields = new Map(
      ConnectGroupParticipants.fields
        .filter((field) => 'name' in field)
        .map((field) => [field.name, field]),
    )

    expect(fields.get('rockPersonId')).toMatchObject({
      type: 'number',
      required: true,
      unique: true,
      index: true,
    })
    expect([...fields.keys()]).toEqual(
      expect.arrayContaining([
        'name',
        'email',
        'phoneNumbers',
        'photoId',
        'isCoach',
        'memberships',
        'lastSyncedAt',
      ]),
    )

    const phoneNumbers = fields.get('phoneNumbers')
    expect(phoneNumbers).toMatchObject({ type: 'array' })
    if (!phoneNumbers || !('fields' in phoneNumbers)) {
      throw new Error('phoneNumbers must be an array')
    }
    expect(
      phoneNumbers.fields.filter((field) => 'name' in field).map((field) => field.name),
    ).toEqual(expect.arrayContaining(['number', 'typeValueId', 'isMessagingEnabled']))

    const memberships = fields.get('memberships')
    expect(memberships).toMatchObject({ type: 'array' })
    if (!memberships || !('fields' in memberships)) throw new Error('memberships must be an array')
    const membershipFields = memberships.fields
      .filter((field) => 'name' in field)
      .map((field) => field.name)
    expect(membershipFields).toEqual(
      expect.arrayContaining([
        'rockGroupId',
        'rockMembershipId',
        'rockRoleId',
        'roleName',
        'isLeader',
      ]),
    )
  })
})
