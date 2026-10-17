import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
const resolveProfile = vi.hoisted(() => vi.fn())
vi.mock('@/auth/rock-member-profile', () => ({ resolveRockMemberProfile: resolveProfile }))
import { canManageReimbursementSettings, isReimbursementFinanceIdentity } from './admin-access'

it('limits settings to exact administrators and currently synced Rock finance members', async () => {
  resolveProfile.mockResolvedValue({ ok: true, profile: { personId: 42 } })
  const query = vi.fn().mockResolvedValue({ rowCount: 0 })
  const payload = { db: { pool: { query } } } as unknown as Payload
  expect(await canManageReimbursementSettings(payload, null)).toBe(false)
  expect(await canManageReimbursementSettings(payload, { email: 'admin@example.com', roles: ['admin'] } as User)).toBe(true)
  expect(query).not.toHaveBeenCalled()
  const editor = { email: 'editor@example.com', roles: ['editor'], auth0Subject: 'auth0|editor' } as User
  expect(await canManageReimbursementSettings(payload, editor)).toBe(false)
  query.mockResolvedValueOnce({ rowCount: 1 })
  expect(await canManageReimbursementSettings(payload, { email: 'finance@example.com', roles: [], auth0Subject: 'auth0|finance' } as unknown as User)).toBe(true)
  expect(query.mock.calls.at(-1)?.[0]).toContain("last_synced_at>now()-interval '45 minutes'")
  expect(query.mock.calls.at(-1)?.[1]).toEqual([42])
  expect(await isReimbursementFinanceIdentity(payload, 'auth0|finance')).toBe(false)
  resolveProfile.mockResolvedValue({ ok: false, reason: 'identity-not-found' })
  query.mockClear()
  expect(await isReimbursementFinanceIdentity(payload, 'auth0|unknown')).toBe(false)
  expect(query).not.toHaveBeenCalled()
})
