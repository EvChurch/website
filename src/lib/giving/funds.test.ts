import { describe, expect, it, vi } from 'vitest'

import { GivingFunds, swapDefaultGivingFund } from '@/collections/GivingFunds'
import { getActiveGivingFunds } from './funds'

describe('giving funds', () => {
  it('allows public reads only for active funds and keeps private fields admin-only', () => {
    expect(GivingFunds.access?.read?.({ req: { user: null } } as never)).toEqual({ active: { equals: true } })
    const accountingKey = GivingFunds.fields.find((field) => 'name' in field && field.name === 'accountingKey')
    expect(accountingKey && 'access' in accountingKey && accountingKey.access?.read?.({ req: { user: null } } as never)).toBe(false)
  })

  it('loads only active display-safe fields', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 1, name: 'General', code: 'GEN', sortOrder: 0, isDefault: true }] })
    await expect(getActiveGivingFunds({ find } as never)).resolves.toEqual([{ id: 1, name: 'General', code: 'GEN', sortOrder: 0, isDefault: true }])
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'giving-funds',
      where: { active: { equals: true } },
      select: { name: true, code: true, sortOrder: true, isDefault: true },
    }))
  })

  it('clears the prior default in the same request transaction before selecting a new one', async () => {
    const update = vi.fn().mockResolvedValue({ docs: [] })
    await swapDefaultGivingFund({ data: { active: true, isDefault: true }, originalDoc: { id: 2 }, req: { payload: { update } } } as never)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'giving-funds', data: { isDefault: false }, overrideAccess: true,
      where: { and: [{ isDefault: { equals: true } }, { id: { not_equals: 2 } }] },
    }))
  })
})
