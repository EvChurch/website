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
  mocks.groups.mockResolvedValue([{Id:29482,IsActive:true,IsArchived:false},{Id:28344,IsActive:true,IsArchived:false}])
})
describe('campaign server authorization', () => {
  it('allows current staff using a freshly resolved identity', async () => {
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(true)
    expect(mocks.profile).toHaveBeenCalledWith('auth0|test')
    expect(mocks.rock.mock.calls[0][0].params.$filter).toContain('PersonId eq 123')
  })
  it('allows the verified Executive Member group and denies unrelated leadership', async () => {
    mocks.rock.mockResolvedValue([{ ...membership, GroupId: 29485 }])
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(false)
    mocks.rock.mockResolvedValue([{ ...membership, GroupId: 28344 }])
    expect((await getCampaignGivingAccess(request, before)).allowed).toBe(true)
    expect(mocks.rock.mock.calls.at(-1)?.[0].params.$filter).toContain('GroupId eq 28344')
  })
  it.each([
    { ...membership, PersonId: 456 }, { ...membership, GroupId: 29485 },
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
