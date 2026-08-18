import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

vi.mock('@/lib/members/data', () => ({
  createMemberGroupComment: mocks.create,
  updateMemberGroupComment: mocks.update,
  deleteMemberGroupComment: mocks.delete,
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import {
  addConnectGroupCommentAction,
  deleteConnectGroupCommentAction,
  updateConnectGroupCommentAction,
} from './comment-actions'

describe('addConnectGroupCommentAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revalidates and returns to the group after a successful comment', async () => {
    mocks.create.mockResolvedValue({ ok: true })
    const form = new FormData()
    form.set('body', 'Update')
    form.set('coachesOnly', 'on')

    await expect(addConnectGroupCommentAction(10, form)).rejects.toThrow('REDIRECT:/members/connect-groups/10/coaching?comment=added')
    expect(mocks.create).toHaveBeenCalledWith(10, { body: 'Update', coachesOnly: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/members/connect-groups/10/coaching')
  })

  it('does not revalidate after a rejected comment', async () => {
    mocks.create.mockResolvedValue({ ok: false, message: 'Denied' })
    const form = new FormData()
    form.set('body', 'Update')

    await expect(addConnectGroupCommentAction(10, form)).rejects.toThrow('REDIRECT:/members/connect-groups/10/coaching?comment=error')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('updates an owned comment and returns to coaching', async () => {
    mocks.update.mockResolvedValue({ ok: true })
    const form = new FormData()
    form.set('body', 'Updated')

    await expect(updateConnectGroupCommentAction(10, 5, form)).rejects.toThrow(
      'REDIRECT:/members/connect-groups/10/coaching?comment=updated',
    )
    expect(mocks.update).toHaveBeenCalledWith(10, 5, { body: 'Updated' })
  })

  it('soft-deletes an owned comment and returns to coaching', async () => {
    mocks.delete.mockResolvedValue({ ok: true })

    await expect(deleteConnectGroupCommentAction(10, 5)).rejects.toThrow(
      'REDIRECT:/members/connect-groups/10/coaching?comment=deleted',
    )
    expect(mocks.delete).toHaveBeenCalledWith(10, 5)
  })
})
