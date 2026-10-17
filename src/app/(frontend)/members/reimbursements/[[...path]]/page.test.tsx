import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ actor: vi.fn(), pool: vi.fn(), open: vi.fn(), overview: vi.fn(), home: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw Error(`REDIRECT:${url}`) }, notFound: () => { throw Error('NOT_FOUND') } }))
vi.mock('@/auth/member-impersonation', () => ({ getCurrentMemberImpersonation: async () => null }))
vi.mock('@/lib/reimbursements/runtime', () => ({ reimbursementActor: mocks.actor, reimbursementPool: mocks.pool }))
vi.mock('@/lib/reimbursements/store', () => ({ openReimbursements: mocks.open, memberOverview: mocks.overview }))
vi.mock('@/lib/members/data', () => ({ getMemberPortalHomeForProfile: mocks.home }))
import Page from './page'
const id = '00000000-0000-4000-8000-000000000001'
const page = (path?: string[], report?: string) => Page({ params: Promise.resolve({ path }), searchParams: Promise.resolve({ report }) })
beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue(null) })
it.each([['approvals'], ['payment-queue'], ['payment-settings'], ['reports', id]])('preserves the requested path through login: %j', async (...path) => {
  const target = `/members/reimbursements/${path.join('/')}`
  await expect(page(path)).rejects.toThrow(`REDIRECT:/auth/login?returnTo=${encodeURIComponent(target)}`)
  expect(mocks.pool).not.toHaveBeenCalled()
})
it('keeps existing email report links working', async () => {
  await expect(page(undefined, id)).rejects.toThrow(`REDIRECT:/members/reimbursements/reports/${id}`)
})
it('rejects unknown paths', async () => { await expect(page(['unknown'])).rejects.toThrow('NOT_FOUND') })
it('does not expose the payment queue to non-finance members', async () => {
  mocks.actor.mockResolvedValue({ personId: 1, finance: false })
  await expect(page(['payment-queue'])).rejects.toThrow('REDIRECT:/members/reimbursements')
  expect(mocks.pool).not.toHaveBeenCalled()
})
it('opens the payment queue for finance', async () => {
  mocks.actor.mockResolvedValue({ personId: 1, finance: true })
  mocks.overview.mockResolvedValue({ reports: [] })
  mocks.home.mockResolvedValue({ profile: {}, groups: [], canAccessLeaderResources: false })
  const result = await page(['payment-queue'])
  expect(result.props.children.props.initialView).toBe('payments')
})
