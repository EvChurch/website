import { rockFetchAll, type RockGroupMember } from '@/lib/rock-api'

export function fetchActiveGroupMembers(groupId: number) {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new Error('Rock group membership fetch requires a durable group Id')
  }

  return rockFetchAll<RockGroupMember>({
    endpoint: 'GroupMembers',
    getKey: (membership) => {
      if (!Number.isInteger(membership.Id) || (membership.Id ?? 0) <= 0) {
        throw new Error('Rock group membership is missing a durable Id')
      }
      return membership.Id as number
    },
    params: {
      $filter: `GroupId eq ${groupId} and GroupMemberStatus eq 'Active' and IsArchived eq false`,
      $expand: 'Person/PhoneNumbers,GroupRole',
      $orderby: 'GroupOrder,Id',
    },
  })
}
