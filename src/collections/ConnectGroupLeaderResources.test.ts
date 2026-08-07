import { describe, expect, it } from 'vitest'

import { ConnectGroupLeaderResources } from './ConnectGroupLeaderResources'

describe('ConnectGroupLeaderResources collection', () => {
  it('allows only Payload admins to read and denies request-scoped mutations', () => {
    const read = ConnectGroupLeaderResources.access?.read
    const create = ConnectGroupLeaderResources.access?.create
    const update = ConnectGroupLeaderResources.access?.update
    const remove = ConnectGroupLeaderResources.access?.delete

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

  it('mirrors the Connect Group Leader Resources content contract', () => {
    const fields = new Map(
      ConnectGroupLeaderResources.fields
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
        'rockGuid',
        'title',
        'status',
        'startDateTime',
        'expireDateTime',
        'campusGuids',
        'campuses',
        'youtubeUrl',
        'promotionalImageGuid',
        'description',
        'hosts',
        'bibleReference',
        'leaderNotesFile',
        'memberStudyFile',
        'priority',
        'sourceOrder',
        'lastSyncedAt',
      ]),
    )

    const hosts = fields.get('hosts')
    expect(hosts).toMatchObject({ type: 'array' })
    if (!hosts || !('fields' in hosts)) throw new Error('hosts must be an array')
    expect(
      hosts.fields.filter((field) => 'name' in field).map((field) => field.name),
    ).toEqual(expect.arrayContaining(['personAliasGuid', 'name', 'photoId']))
  })
})
