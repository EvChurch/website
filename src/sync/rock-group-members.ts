import { rockFetch, type RockGroupMember } from '@/lib/rock-api'

export function fetchActiveGroupMembers(groupId: number) {
  return rockFetch<RockGroupMember[]>({
    endpoint: 'GroupMembers',
    params: {
      $filter: `GroupId eq ${groupId} and GroupMemberStatus eq 1 and IsArchived eq false`,
      $expand: 'Person,GroupRole',
      $orderby: 'GroupOrder',
    },
  })
}
