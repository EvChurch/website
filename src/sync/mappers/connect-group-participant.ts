import type { RockGroupMember, RockPerson } from '@/lib/rock-api'
import { getRockPersonName } from './person'

export type MappedConnectGroupMembership = {
  rockGroupId: number
  rockMembershipId: number
  rockRoleId: number
  roleName: string
  isLeader: boolean
}

export type MappedConnectGroupParticipant = {
  rockPersonId: number
  name: string
  email: string | null
  phoneNumbers: Array<{
    number: string
    typeValueId: number | null
    isMessagingEnabled: boolean
  }>
  photoId: number | null
  isCoach: boolean
  memberships: MappedConnectGroupMembership[]
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized || null
}

function listedPhoneNumbers(person: RockPerson): MappedConnectGroupParticipant['phoneNumbers'] {
  const seen = new Set<string>()
  const phoneNumbers: MappedConnectGroupParticipant['phoneNumbers'] = []
  for (const phone of person.PhoneNumbers ?? []) {
    if (phone.IsUnlisted === true) continue
    const number = optionalText(phone.NumberFormatted) ?? optionalText(phone.Number)
    if (!number || seen.has(number)) continue
    seen.add(number)
    phoneNumbers.push({
      number,
      typeValueId: Number.isInteger(phone.NumberTypeValueId)
        ? (phone.NumberTypeValueId ?? null)
        : null,
      isMessagingEnabled: phone.IsMessagingEnabled === true,
    })
  }
  return phoneNumbers
}

function isCompleteMembership(
  membership: RockGroupMember,
): membership is RockGroupMember & {
  Id: number
  GroupId: number
  GroupRoleId: number
} {
  return (
    Number.isInteger(membership.Id) &&
    Number.isInteger(membership.GroupId) &&
    Number.isInteger(membership.GroupRoleId)
  )
}

/** Maps one Rock person and their already-filtered active Connect Group memberships. */
export function mapRockConnectGroupParticipant(
  person: RockPerson,
  memberships: RockGroupMember[],
  isCoach = false,
): MappedConnectGroupParticipant {
  return {
    rockPersonId: person.Id,
    name: getRockPersonName(person).replace(/\s+/g, ' '),
    email: optionalText(person.Email),
    phoneNumbers: listedPhoneNumbers(person),
    photoId: Number.isInteger(person.PhotoId) ? (person.PhotoId ?? null) : null,
    isCoach,
    memberships: memberships
      .filter(
        (
          membership,
        ): membership is RockGroupMember & { Id: number; GroupId: number; GroupRoleId: number } =>
          membership.Person.Id === person.Id && isCompleteMembership(membership) && !!membership.GroupRole,
      )
      .map((membership) => {
        const roleName = membership.GroupRole.Name.trim()
        return {
          rockGroupId: membership.GroupId,
          rockMembershipId: membership.Id,
          rockRoleId: membership.GroupRoleId,
          roleName,
          isLeader: membership.GroupRole.IsLeader === true,
        }
      }),
  }
}
