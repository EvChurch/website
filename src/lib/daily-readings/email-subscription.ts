import { rockFetch } from '@/lib/rock-api'

export const DAILY_BIBLE_READING_LIST_GROUP_ID = 28916
export const DAILY_BIBLE_READING_TAG_ID = 134

const ACTIVE_GROUP_MEMBER_STATUS = 1
const ROCK_SUBSCRIPTION_READ_TIMEOUT_MS = 3_000
const ROCK_COMMUNICATION_SUBSCRIBE_PAGE_GUID =
  '0dc2e79d-3590-45e8-a16b-c720a134ba51'
const ROCK_COMMUNICATION_SUBSCRIBE_BLOCK_GUID =
  'b2ccf6ec-8c07-4b02-9e3a-6d5674050141'
const DAILY_BIBLE_READING_LIST_GROUP_GUID =
  '9163f4c1-90b4-4bd3-a9e1-1a7cf201a86b'

type RockGroupMembership = {
  Id: number
  GroupMemberStatus: number
  IsArchived: boolean
}

type RockPersonGuid = {
  Guid?: string | null
}

function validPersonId(personId: number): number {
  if (!Number.isInteger(personId) || personId <= 0) {
    throw new Error('Daily Bible Reading signup requires a valid Rock person')
  }
  return personId
}

async function membershipsForPerson(
  personId: number,
): Promise<RockGroupMembership[]> {
  return rockFetch<RockGroupMembership[]>({
    endpoint: 'GroupMembers',
    retries: 0,
    timeoutMs: ROCK_SUBSCRIPTION_READ_TIMEOUT_MS,
    params: {
      $filter: `GroupId eq ${DAILY_BIBLE_READING_LIST_GROUP_ID} and PersonId eq ${personId} and IsArchived eq false`,
      $select: 'Id,GroupMemberStatus,IsArchived',
      $orderby: 'Id desc',
      $top: '10',
    },
  })
}

async function personHasSignupTag(personId: number): Promise<boolean> {
  const person = await rockFetch<RockPersonGuid>({
    endpoint: `People/${personId}`,
    retries: 0,
    timeoutMs: ROCK_SUBSCRIPTION_READ_TIMEOUT_MS,
    params: { $select: 'Guid' },
  })
  const personGuid = person.Guid?.toLowerCase()
  if (!personGuid) throw new Error('Rock person is missing a Guid')

  const taggedItems = await rockFetch<Array<{ Id: number }>>({
    endpoint: 'TaggedItems',
    retries: 0,
    timeoutMs: ROCK_SUBSCRIPTION_READ_TIMEOUT_MS,
    params: {
      $filter: `TagId eq ${DAILY_BIBLE_READING_TAG_ID} and EntityGuid eq guid'${personGuid}'`,
      $select: 'Id',
      $top: '1',
    },
  })
  return taggedItems.length > 0
}

export async function isDailyReadingEmailSubscribed(
  personId: number,
): Promise<boolean> {
  validPersonId(personId)
  const memberships = await membershipsForPerson(personId)
  if (memberships.some((membership) =>
    membership.GroupMemberStatus === ACTIVE_GROUP_MEMBER_STATUS
  )) {
    return true
  }
  if (memberships.length > 0) return false

  // Rock syncs the signup tag into the communication list every six hours.
  // A new signup is subscribed while it is waiting for that sync.
  return personHasSignupTag(personId)
}

async function subscribeThroughRockCommunicationListBlock(
  personId: number,
): Promise<void> {
  await rockFetch<void>({
    endpoint: `v2/BlockActions/${ROCK_COMMUNICATION_SUBSCRIBE_PAGE_GUID}/${ROCK_COMMUNICATION_SUBSCRIBE_BLOCK_GUID}/UpdateSubscription`,
    method: 'POST',
    body: {
      __context: {
        pageParameters: { PersonId: String(personId) },
      },
      bag: {
        communicationListGuid: DAILY_BIBLE_READING_LIST_GROUP_GUID,
        isSubscribed: true,
      },
    },
    retries: 0,
  })
}

export async function subscribeDailyReadingEmail(
  personId: number,
): Promise<{ alreadySubscribed: boolean }> {
  validPersonId(personId)
  const memberships = await membershipsForPerson(personId)
  const active = memberships.find(
    (membership) =>
      membership.GroupMemberStatus === ACTIVE_GROUP_MEMBER_STATUS,
  )
  if (active) return { alreadySubscribed: true }

  await subscribeThroughRockCommunicationListBlock(personId)
  const updatedMemberships = await membershipsForPerson(personId)
  if (!updatedMemberships.some(
    (membership) =>
      membership.GroupMemberStatus === ACTIVE_GROUP_MEMBER_STATUS,
  )) {
    throw new Error('Daily Bible Reading membership was not activated')
  }
  return { alreadySubscribed: false }
}
