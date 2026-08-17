import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }))

vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }))

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

  it('invalidates cached redirects after editor changes and deletes', () => {
    const afterChange = MissingPaths.hooks?.afterChange?.[0]
    const afterDelete = MissingPaths.hooks?.afterDelete?.[0]

    expect(afterChange).toBeTypeOf('function')
    expect(afterDelete).toBeTypeOf('function')
    ;(afterChange as () => void)()
    ;(afterDelete as () => void)()

    expect(mocks.revalidateTag).toHaveBeenNthCalledWith(1, 'missing-paths', { expire: 0 })
    expect(mocks.revalidateTag).toHaveBeenNthCalledWith(2, 'missing-paths', { expire: 0 })
  })
})
