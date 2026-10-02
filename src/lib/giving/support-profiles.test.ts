import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { SupportProfiles } from '@/collections/SupportProfiles'
import { getPublicSupportProfiles } from './support-profiles'

describe('support profiles', () => {
  it('restricts editing to admins and unpublished reads to admins', () => {
    const anonymous = { req: { user: null } } as never
    const editor = { req: { user: { roles: ['editor'] } } } as never
    const admin = { req: { user: { roles: ['admin'] } } } as never
    expect(SupportProfiles.access?.read?.(anonymous)).toEqual({ published: { equals: true } })
    expect(SupportProfiles.access?.read?.(editor)).toEqual({ published: { equals: true } })
    expect(SupportProfiles.access?.read?.(admin)).toBe(true)
    expect(SupportProfiles.access?.update?.(editor)).toBe(false)
    expect(SupportProfiles.access?.update?.(admin)).toBe(true)
  })

  it('requires real photo, blurb and email before publishing', () => {
    const validate = SupportProfiles.hooks!.beforeChange![0]
    expect(() => validate({ data: { published: true, photo: 1, blurb: 'Bio' }, originalDoc: {} } as never)).toThrow('email')
    const profile = { published: true, photo: 1, blurb: 'Bio', email: 'liz@example.com' }
    expect(validate({ data: profile, originalDoc: {} } as never)).toEqual(profile)
  })

  it('joins published profiles to active funds without name matching', async () => {
    const find = vi.fn().mockImplementation(async ({ collection }: { collection: string }) => ({ docs: collection === 'support-profiles'
      ? [{ id: 8, name: 'Liz Halliday', slug: 'liz-halliday', group: 'apprentices', photo: { id: 2, url: '/liz.jpg' }, blurb: 'Approved bio', email: 'liz@example.com' }, { id: 9, name: 'Henry Huang', slug: 'henry-huang', group: 'student-ministers', photo: null }]
      : [{ id: 12, name: 'Liz ministry support', supportProfile: 8 }] }))
    const payload = { find } as unknown as Payload
    const profiles = await getPublicSupportProfiles(payload)
    expect(profiles[0]).toMatchObject({ name: 'Liz Halliday', fundId: 12, fundName: 'Liz ministry support' })
    expect(profiles[1]).toMatchObject({ name: 'Henry Huang', fundId: null })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'support-profiles', where: { published: { equals: true } }, depth: 1 }))
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'giving-funds', where: { active: { equals: true } }, depth: 0, select: { name: true, supportProfile: true } }))
  })
})
