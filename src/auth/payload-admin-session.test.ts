import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ user: null as null | { roles?: string[] }, fail: false }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({
    auth: vi.fn(async () => {
      if (state.fail) throw new Error('unavailable')
      return { user: state.user }
    }),
  })),
}))

import { isCurrentPayloadAdmin } from './payload-admin-session'

describe('current Payload administrator lookup', () => {
  beforeEach(() => {
    state.user = null
    state.fail = false
  })

  it('accepts only the exact admin role', async () => {
    for (const roles of [['editor'], ['content-lead'], [], undefined]) {
      state.user = roles === undefined ? null : { roles }
      await expect(isCurrentPayloadAdmin(new Headers())).resolves.toBe(false)
    }
    state.user = { roles: ['admin'] }
    await expect(isCurrentPayloadAdmin(new Headers())).resolves.toBe(true)
  })

  it('fails closed when Payload authentication is unavailable', async () => {
    state.fail = true
    await expect(isCurrentPayloadAdmin(new Headers())).resolves.toBe(false)
  })
})
