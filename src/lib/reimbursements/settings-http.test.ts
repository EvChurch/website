import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), profile: vi.fn(), directory: vi.fn(), configure: vi.fn(), rock: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({ auth: mocks.auth, db: { pool: { query: mocks.query } } }) }))
vi.mock('@/auth/rock-member-profile', () => ({ resolveRockMemberProfile: mocks.profile }))
vi.mock('@/lib/rock-api', () => ({ rockFetch: mocks.rock }))
vi.mock('./runtime', () => ({ reimbursementPool: async () => ({ query: mocks.query }), reimbursementActor: vi.fn() }))
vi.mock('./store', async importOriginal => ({ ...await importOriginal<typeof import('./store')>(), directory: mocks.directory, configure: mocks.configure }))
import { handleReimbursementRequest } from './http'
const settings = { seniorPersonId: null, seniorName: '', seniorEmail: '', alternatePersonId: null, alternateName: '', alternateEmail: '', financeEmail: 'finance@example.com' }
const endpoint = 'https://example.com/api/reimbursements/settings'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { collection: 'users', email: 'admin@example.com', roles: ['admin'], auth0Subject: 'auth0|admin' } })
  mocks.profile.mockResolvedValue({ ok: true, profile: { personId: 42 } })
  mocks.query.mockResolvedValue({ rowCount: 0 })
  mocks.directory.mockResolvedValue({ settings, categories: [] })
})
it('lets Payload administrators configure reimbursements without a member profile', async () => {
  const response = await handleReimbursementRequest(new NextRequest(endpoint), ['settings'])
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ settings, categories: [] })
  expect(mocks.profile).not.toHaveBeenCalled()
})
it('requires current Rock finance membership and excludes other CMS users and API keys', async () => {
  mocks.auth.mockResolvedValue({ user: { collection: 'users', email: 'finance@example.com', roles: [], auth0Subject: 'auth0|finance' } })
  mocks.query.mockResolvedValueOnce({ rowCount: 1 })
  expect((await handleReimbursementRequest(new NextRequest(endpoint), ['settings'])).status).toBe(200)
  expect((await handleReimbursementRequest(new NextRequest(endpoint), ['settings'])).status).toBe(403)
  mocks.auth.mockResolvedValue({ user: { collection: 'users', email: 'editor@example.com', roles: ['editor'], auth0Subject: 'auth0|editor' } })
  expect((await handleReimbursementRequest(new NextRequest(endpoint), ['settings'])).status).toBe(403)
  mocks.auth.mockResolvedValue({ user: { collection: 'payload-mcp-api-keys', roles: ['admin'] } })
  expect((await handleReimbursementRequest(new NextRequest(endpoint), ['settings'])).status).toBe(403)
})
it('resolves approver details from Rock and rejects cross-origin settings writes', async () => {
  const input = { settings: { ...settings, seniorPersonId: 4, seniorName: 'Forged', seniorEmail: 'forged@example.com' }, categories: [] }
  mocks.rock.mockResolvedValue({ Id: 4, NickName: 'Actual', LastName: 'Approver', Email: 'actual@example.com' })
  const request = (origin: string) => new NextRequest(endpoint, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  expect((await handleReimbursementRequest(request('https://untrusted.example'), ['settings'])).status).toBe(403)
  expect(mocks.configure).not.toHaveBeenCalled()
  expect((await handleReimbursementRequest(request('https://example.com'), ['settings'])).status).toBe(200)
  expect(mocks.configure.mock.calls[0][2].settings).toMatchObject({ seniorPersonId: 4, seniorName: 'Actual Approver', seniorEmail: 'actual@example.com' })
})
