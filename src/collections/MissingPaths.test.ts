import { describe, expect, it } from 'vitest'

import { MissingPaths } from './MissingPaths'

const access = MissingPaths.access!
const args = (roles?: string[]) => ({
  req: { user: roles ? { roles } : null },
}) as never

describe('MissingPaths collection', () => {
  it('is private outside Payload editor roles', async () => {
    expect(await access.read!(args())).toBe(false)
    expect(await access.create!(args(['member']))).toBe(false)
    expect(await access.update!(args(['member']))).toBe(false)
    expect(await access.delete!(args(['member']))).toBe(false)
  })

  it.each(['admin', 'content-lead', 'editor'])('allows %s administration', async (role) => {
    expect(await access.read!(args([role]))).toBe(true)
    expect(await access.update!(args([role]))).toBe(true)
  })

  it('contains only aggregate and redirect fields without workflow controls', () => {
    expect(MissingPaths.versions).toBeUndefined()
    expect(MissingPaths.fields.map((field) => 'name' in field ? field.name : null)).toEqual([
      'path',
      'count',
      'destination',
    ])
  })
})
