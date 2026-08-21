import { DAILY_BIBLE_READING_EMAIL_WORKFLOW_GUID } from '@/lib/daily-readings/constants'
import { rockFetch } from '@/lib/rock-api'
import { ROCK_ENTRY_FORM_COMPONENT_URL } from '@/lib/rock-forms/constants'
import { verifyRockFormContextToken } from '@/lib/rock-forms/context-token'
import { startRockForm, submitRockForm } from '@/lib/rock-forms/server'

export const DAILY_BIBLE_READING_LIST_GROUP_ID = 28916
export const DAILY_BIBLE_READING_TAG_ID = 134

const ACTIVE_GROUP_MEMBER_STATUS = 1

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
    params: { $select: 'Guid' },
  })
  const personGuid = person.Guid?.toLowerCase()
  if (!personGuid) throw new Error('Rock person is missing a Guid')

  const taggedItems = await rockFetch<Array<{ Id: number }>>({
    endpoint: 'TaggedItems',
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

async function submitExistingSignupWorkflow(personId: number): Promise<void> {
  const form = await startRockForm(
    DAILY_BIBLE_READING_EMAIL_WORKFLOW_GUID,
    personId,
  )
  const context = verifyRockFormContextToken(form.contextToken)
  if (
    context.personId !== personId ||
    !context.hidePersonEntryWhenKnown ||
    form.personEntry !== null ||
    form.fields.length !== 0 ||
    form.buttons.length !== 1
  ) {
    throw new Error('Daily Bible Reading signup workflow contract changed')
  }

  const { action } = await submitRockForm({
    context,
    fieldValues: context.initialFieldValues,
    personEntryValues: context.knownPersonEntryValues ?? null,
    button: form.buttons[0].title,
  })
  if (action.actionData?.componentUrl === ROCK_ENTRY_FORM_COMPONENT_URL) {
    throw new Error('Daily Bible Reading signup workflow did not complete')
  }
  if (!(await personHasSignupTag(personId))) {
    throw new Error('Daily Bible Reading signup tag was not applied')
  }
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

  const inactive = memberships[0]
  if (inactive) {
    await rockFetch<void>({
      endpoint: `GroupMembers/${inactive.Id}`,
      method: 'PATCH',
      body: {
        GroupMemberStatus: ACTIVE_GROUP_MEMBER_STATUS,
        IsArchived: false,
        InactiveDateTime: null,
      },
      retries: 0,
    })
    const updatedMemberships = await membershipsForPerson(personId)
    if (!updatedMemberships.some(
      (membership) =>
        membership.GroupMemberStatus === ACTIVE_GROUP_MEMBER_STATUS,
    )) {
      throw new Error('Daily Bible Reading membership was not reactivated')
    }
    return { alreadySubscribed: false }
  }

  if (await personHasSignupTag(personId)) {
    return { alreadySubscribed: true }
  }

  await submitExistingSignupWorkflow(personId)
  return { alreadySubscribed: false }
}
