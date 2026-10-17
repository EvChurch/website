import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createResolvedMemberMarker } from '@/auth/member-session'
import { startMemberImpersonation } from '@/auth/member-impersonation'

const mocks = vi.hoisted(() => ({ session: vi.fn(), query: vi.fn(), admin: vi.fn() }))
vi.mock('@/auth/auth0-client', () => ({ getAuth0Client: () => ({ getSession: mocks.session }) }))
vi.mock('@/auth/payload-admin-session', () => ({ isCurrentPayloadAdmin: mocks.admin }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({ db: { pool: { connect() {}, query: mocks.query } } }) }))
import { reimbursementActor } from './runtime'

const profile = { personId: 42, name: 'Aroha', email: 'aroha@example.com', photoUrl: null }
const session = { user: { sub: 'auth0|42' }, tokenSet: { accessToken: 'synthetic', expiresAt: 0 }, internal: { sid: 'synthetic', createdAt: 0 }, rockProfile: createResolvedMemberMarker(profile) }
const request = new NextRequest('https://example.com/api/reimbursements')
beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue(false); mocks.query.mockResolvedValue({ rowCount: 0 }); mocks.session.mockResolvedValue(session) })
it('requires a resolved current member session and checks current finance membership on each request', async () => {
  expect(await reimbursementActor(request)).toMatchObject({ personId: 42, finance: false, admin: false })
  mocks.query.mockResolvedValueOnce({ rowCount: 1 })
  expect(await reimbursementActor(request)).toMatchObject({ finance: true })
  expect(await reimbursementActor(request)).toMatchObject({ finance: false })
  expect(mocks.query.mock.calls[0][1]).toEqual([42])
  mocks.session.mockResolvedValue(null)
  expect(await reimbursementActor(request)).toBeNull()
  mocks.session.mockResolvedValue({ ...session, rockProfile: { version: 3, status: 'unresolved' } })
  expect(await reimbursementActor(request)).toBeNull()
})
it('blocks impersonation from viewing or acting on reimbursement data', async () => {
  mocks.session.mockResolvedValue(startMemberImpersonation(session, { ...profile, personId: 99, name: 'Target', email: 'target@example.com' }))
  expect(await reimbursementActor(request)).toBeNull()
  expect(mocks.query).not.toHaveBeenCalled()
})
