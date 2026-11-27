import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), impersonation: vi.fn(), profile: vi.fn(), rock: vi.fn(), groups: vi.fn() }))
vi.mock('@/auth/auth0-client', () => ({ getAuth0Client: () => ({ getSession: mocks.session }) }))
vi.mock('@/auth/member-impersonation', () => ({ getMemberImpersonationFromSession: mocks.impersonation }))
vi.mock('@/auth/rock-member-profile', () => ({ resolveRockMemberProfile: mocks.profile }))
vi.mock('@/auth/member-rock-client', () => ({ memberRockFetch: (input: {endpoint:string}) => input.endpoint === 'Groups' ? mocks.groups(input) : mocks.rock(input) }))
import { getCampaignGivingAccess } from './campaign-access-server'
const request = new NextRequest('http://localhost/api/giving/campaign-access')
const before = new Date('2026-12-04T10:59:59.999Z')
const membership = { PersonId: 123, GroupId: 29482, GroupMemberStatus: 1, IsArchived: false }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { sub: 'auth0|test' } })
  mocks.impersonation.mockReturnValue(null)
  mocks.profile.mockResolvedValue({ ok: true, profile: { personId: 123 } })
  mocks.rock.mockResolvedValue([membership])
  mocks.groups.mockResolvedValue([29482, 29485, 29486, 28344].map(Id => ({ Id, IsActive: true, IsArchived: false })))
})
describe('campaign server authorization', () => {
  it('keeps session lookup body-free after checkout has consumed a POST', async () => {
    const post = new NextRequest('https://www.ev.church/api/giving/checkouts', {
      method: 'POST', headers: { cookie: 'session=test-session', origin: 'https://www.ev.church' }, body: JSON.stringify({ amountMinor: 100 }),
    })
    await post.json()
    expect(post.bodyUsed).toBe(true)
    mocks.session.mockImplementation(async (input: Request) => {
      // Auth0 can rebuild NextRequest across its external/bundled boundary.
      const normalized = new Request(input)
      expect(normalized.method).toBe('GET')
      expect(normalized.body).toBeNull()
      expect(normalized.headers.get('cookie')).toBe('session=test-session')
      expect(normalized.headers.get('origin')).toBe('https://www.ev.church')
      return { user: { sub: 'auth0|test' } }
    })
    expect((await getCampaignGivingAccess(post, before)).allowed).toBe(true)
    expect(mocks.session).toHaveBeenCalledOnce()
  })
  it('allows current staff using a freshly resolved identity', async () => {
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(true)
    expect(mocks.profile).toHaveBeenCalledWith('auth0|test')
    expect(mocks.rock.mock.calls[0][0].params.$filter).toContain('PersonId eq 123')
  })
  it.each([29482, 29485, 29486, 28344])('allows active membership in approved group %i', async GroupId => {
    mocks.rock.mockResolvedValue([{ ...membership, GroupId }])
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(true)
    expect(mocks.rock.mock.calls.at(-1)?.[0].params.$filter).toContain(`GroupId eq ${GroupId}`)
    expect(mocks.groups.mock.calls.at(-1)?.[0].params.$filter).toContain(`Id eq ${GroupId}`)
  })
  it.each([29482, 29485, 29486, 28344])('denies inactive or archived approved group %i', async GroupId => {
    mocks.rock.mockResolvedValue([{ ...membership, GroupId }])
    mocks.groups.mockResolvedValue([{ Id: GroupId, IsActive: false, IsArchived: false }])
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
    mocks.groups.mockResolvedValue([{ Id: GroupId, IsActive: true, IsArchived: true }])
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
  })
  it.each([
    { ...membership, PersonId: 456 }, { ...membership, GroupId: 39111 },
    { ...membership, GroupMemberStatus: 0 }, { ...membership, IsArchived: true },
  ])('denies stale, unrelated or ineligible membership: %j', async member => {
    mocks.rock.mockResolvedValue([member])
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
  })
  it.each([
    {groups:[{Id:29482,IsActive:false,IsArchived:false}]},
    {groups:[{Id:29482,IsActive:true,IsArchived:true}]},
    {groups:[{Id:999,IsActive:true,IsArchived:false}]}, {groups:[]}, {groups:null},
  ])('denies missing, inactive or archived source groups: %j', async ({groups}) => {
    mocks.groups.mockResolvedValue(groups)
    expect((await getCampaignGivingAccess(request,before)).allowed).toBe(false)
  })
  it('denies anonymous, ordinary members and impersonation', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
    expect(mocks.rock).not.toHaveBeenCalled()
    mocks.session.mockResolvedValue({ user: { sub: 'auth0|test' } })
    mocks.rock.mockResolvedValue([])
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
    mocks.impersonation.mockReturnValue({ personId: 123 })
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
  })
  it('fails closed on identity or upstream failure', async () => {
    mocks.profile.mockResolvedValue({ ok: false })
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
    mocks.profile.mockRejectedValue(new Error('offline'))
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
  })
  it('opens to anonymous visitors at midnight Auckland without an auth dependency', async () => {
    mocks.session.mockRejectedValue(new Error('offline'))
    expect((await getCampaignGivingAccess(request, new Date('2026-12-04T11:00:00Z')))).toMatchObject({ allowed: true, publicAccess: true })
    expect(mocks.session).not.toHaveBeenCalled()
  })
})
