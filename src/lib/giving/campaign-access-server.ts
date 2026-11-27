import { NextRequest } from 'next/server'
import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { resolveRockMemberProfile } from '@/auth/rock-member-profile'
import { memberRockFetch } from '@/auth/member-rock-client'
import { campaignGivingAccess, campaignPublicAccess } from './campaign-access'

// Current Rock groups verified on 28 Nov 2026. Require active membership
// in an active, unarchived group; the broader staff security group is excluded.
const PASTORAL_TEAM_GROUP_ID = 29482
const STAFF_TEAM_GROUP_ID = 29485
const MINISTRY_APPRENTICES_GROUP_ID = 29486
const EXEC_GROUP_ID = 28344
interface Membership {
  PersonId: number
  GroupId: number
  GroupMemberStatus: number
  IsArchived: boolean
}
interface Group { Id: number; IsActive: boolean; IsArchived: boolean }
export async function getCampaignGivingAccess(request: NextRequest, now = new Date()) {
  if (campaignPublicAccess(now)) return campaignGivingAccess(false, now)
  let stage = 'session'
  try {
    // Checkout has already consumed the POST body. Auth0 may normalize the
    // request with a different NextRequest constructor, which cannot reuse a
    // consumed stream. Session lookup needs only the original URL and headers.
    const sessionRequest = new NextRequest(request.url, { headers: request.headers })
    const session = await getAuth0Client().getSession(sessionRequest)
    if (!session?.user.sub || getMemberImpersonationFromSession(session)) return campaignGivingAccess(false, now)
    stage = 'profile'
    const resolution = await resolveRockMemberProfile(session.user.sub)
    if (!resolution.ok) return campaignGivingAccess(false, now)
    const personId = resolution.profile.personId
    stage = 'memberships'
    const groups = [PASTORAL_TEAM_GROUP_ID, STAFF_TEAM_GROUP_ID, MINISTRY_APPRENTICES_GROUP_ID, EXEC_GROUP_ID]
    // Rock does not expose Group as an expandable GroupMember property.
    const [memberships, currentGroups] = await Promise.all([
      memberRockFetch<Membership[]>({ endpoint: 'GroupMembers', params: {
        $filter: `PersonId eq ${personId} and (${groups.map(id => `GroupId eq ${id}`).join(' or ')}) and GroupMemberStatus eq 'Active' and IsArchived eq false`,
        $select: 'PersonId,GroupId,GroupMemberStatus,IsArchived',
      } }),
      memberRockFetch<Group[]>({ endpoint: 'Groups', params: {
        $filter: groups.map(id => `Id eq ${id}`).join(' or '), $select: 'Id,IsActive,IsArchived',
      } }),
    ])
    const eligibleGroups = Array.isArray(currentGroups) ? currentGroups.filter(group => groups.includes(group.Id) && group.IsActive === true && group.IsArchived === false).map(group => group.Id) : []
    const allowed = Array.isArray(memberships) && memberships.some(member =>
      member.PersonId === personId && eligibleGroups.includes(member.GroupId)
      && member.GroupMemberStatus === 1 && member.IsArchived === false)
    return campaignGivingAccess(allowed, now)
  } catch {
    console.warn({ event: 'campaign_giving_access_unavailable', stage })
    return campaignGivingAccess(false, now)
  }
}
