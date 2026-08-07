import { describe, expect, it } from 'vitest'

import { ConnectGroups } from './ConnectGroups'

describe('ConnectGroups collection', () => {
  it('keeps public reads while denying request-scoped mutations to the Rock mirror', () => {
    const read = ConnectGroups.access?.read
    const create = ConnectGroups.access?.create
    const update = ConnectGroups.access?.update
    const remove = ConnectGroups.access?.delete

    expect(typeof read === 'function' && read({} as never)).toBe(true)
    expect(typeof create === 'function' && create({} as never)).toBe(false)
    expect(typeof update === 'function' && update({} as never)).toBe(false)
    expect(typeof remove === 'function' && remove({} as never)).toBe(false)
  })
})
