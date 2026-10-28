import type { PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

import { getPayloadClient } from '@/lib/payload'
import { rockFetchAll } from '@/lib/rock-api'
import type { SyncResult } from './sync-runner'

// Verified against the existing Rock Reimbursement Request workflow.
export const REIMBURSEMENT_CENTRES_DEFINED_TYPE_ID = 123
export const REIMBURSEMENT_FINANCE_GROUPS = [
  { id: 18, guid: '6246a7ef-b7a3-4c8c-b1e4-3ff114b84559' },
  { id: 19, guid: '2539cf5d-e2ce-4706-8bbf-4a9df8e763e9' },
] as const

interface RockExpenseCentre {
  Id: number
  Guid: string
  DefinedTypeId: number
  Value: string
  Order: number
  IsActive: boolean
  AttributeValues: { Supervisor?: { Value: string | null } }
}

interface RockFinanceGroup {
  Id: number
  Guid: string
  Name: string
  IsActive: boolean
  IsArchived: boolean
  IsSecurityRole: boolean
}

interface RockDirectoryPerson {
  Id: number
  NickName: string
  LastName: string
  Email: string | null
}

interface RockSupervisorAlias {
  Id: number
  Guid: string
  PersonId: number
  Person: RockDirectoryPerson
}

interface RockFinanceMembership {
  Id: number
  GroupId: number
  PersonId: number
  GroupMemberStatus: number
  IsArchived: boolean
  Person: RockDirectoryPerson
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERSON_SELECT = 'Person/Id,Person/NickName,Person/LastName,Person/Email'

function durableId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Rock reimbursement record has no durable Id')
  return id
}

function personDetails(person: RockDirectoryPerson, personId: number) {
  if (!person || durableId(person.Id) !== durableId(personId)) {
    throw new Error('Rock reimbursement person identity does not match')
  }
  const name = `${person.NickName ?? ''} ${person.LastName ?? ''}`.trim()
  if (!name) throw new Error('Rock reimbursement person has no name')
  return { name, email: person.Email?.trim() || null }
}

/** Fetch everything first, then commit centres and finance membership together. */
export async function syncReimbursementDirectory(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'reimbursement-directory', created: 0, updated: 0, deleted: 0, errors: [],
  }

  try {
    const [centres, financeGroups] = await Promise.all([
      rockFetchAll<RockExpenseCentre>({
        endpoint: 'DefinedValues',
        getKey: centre => durableId(centre.Id),
        params: {
          $filter: `DefinedTypeId eq ${REIMBURSEMENT_CENTRES_DEFINED_TYPE_ID}`,
          $orderby: 'Order,Id',
          loadAttributes: 'simple',
        },
      }),
      rockFetchAll<RockFinanceGroup>({
        endpoint: 'Groups',
        getKey: group => durableId(group.Id),
        params: {
          $filter: REIMBURSEMENT_FINANCE_GROUPS.map(group => `Id eq ${group.id}`).join(' or '),
          $orderby: 'Id',
          $select: 'Id,Guid,Name,IsActive,IsArchived,IsSecurityRole',
        },
      }),
    ])

    for (const expected of REIMBURSEMENT_FINANCE_GROUPS) {
      const group = financeGroups.find(group => group.Id === expected.id)
      if (!group || group.Guid?.toLowerCase() !== expected.guid || group.IsSecurityRole !== true ||
        typeof group.IsActive !== 'boolean' || typeof group.IsArchived !== 'boolean') {
        throw new Error(`Rock finance security role ${expected.id} could not be verified`)
      }
    }

    const aliasGuids = new Set<string>()
    for (const centre of centres) {
      if (centre.DefinedTypeId !== REIMBURSEMENT_CENTRES_DEFINED_TYPE_ID ||
        !GUID.test(centre.Guid) || !centre.Value?.trim() || !Number.isFinite(centre.Order) ||
        typeof centre.IsActive !== 'boolean' || !centre.AttributeValues) {
        throw new Error(`Invalid Rock responsibility centre ${centre.Id}`)
      }
      const guid = centre.AttributeValues.Supervisor?.Value?.trim().toLowerCase()
      if (guid && !GUID.test(guid)) throw new Error(`Invalid Rock supervisor for centre ${centre.Id}`)
      if (guid) aliasGuids.add(guid)
    }

    const aliases = new Map<string, RockSupervisorAlias>()
    // Small, bounded reads; shared supervisors are resolved just once.
    for (const guid of aliasGuids) {
      const matches = await rockFetchAll<RockSupervisorAlias>({
        endpoint: 'PersonAlias',
        getKey: alias => durableId(alias.Id),
        params: {
          $filter: `Guid eq guid'${guid}'`, $orderby: 'Id', $expand: 'Person',
          $select: `Id,Guid,PersonId,${PERSON_SELECT}`,
        },
      })
      if (matches.length !== 1 || matches[0].Guid?.toLowerCase() !== guid) {
        throw new Error(`Rock reimbursement supervisor ${guid} could not be resolved uniquely`)
      }
      personDetails(matches[0].Person, matches[0].PersonId)
      aliases.set(guid, matches[0])
    }

    const syncedAt = new Date().toISOString()
    const preparedCentres: RequiredDataFromCollectionSlug<'responsibility-centres'>[] = centres.map(centre => {
      const guid = centre.AttributeValues.Supervisor?.Value?.trim().toLowerCase() || null
      const alias = guid ? aliases.get(guid) : undefined
      const person = alias ? personDetails(alias.Person, alias.PersonId) : null
      return {
        rockId: centre.Id, rockGuid: centre.Guid.toLowerCase(), name: centre.Value.trim(),
        sortOrder: centre.Order, isActive: centre.IsActive, isLocal: false, financeOnly: false,
        approverPersonAliasGuid: guid, approverRockPersonId: alias?.PersonId ?? null,
        approverName: person?.name ?? null, approverEmail: person?.email ?? null,
        lastSyncedAt: syncedAt,
      }
    })
    const preparedMembers: RequiredDataFromCollectionSlug<'reimbursement-finance-members'>[] = []
    for (const expected of REIMBURSEMENT_FINANCE_GROUPS) {
      const group = financeGroups.find(group => group.Id === expected.id)!
      if (!group.IsActive || group.IsArchived) continue
      const members = await rockFetchAll<RockFinanceMembership>({
        endpoint: 'GroupMembers',
        getKey: member => durableId(member.Id),
        params: {
          $filter: `GroupId eq ${group.Id} and GroupMemberStatus eq 'Active' and IsArchived eq false`,
          $orderby: 'Id', $expand: 'Person',
          $select: `Id,GroupId,PersonId,GroupMemberStatus,IsArchived,${PERSON_SELECT}`,
        },
      })
      for (const member of members) {
        if (member.GroupId !== group.Id || member.GroupMemberStatus !== 1 || member.IsArchived !== false) {
          throw new Error(`Invalid Rock finance membership ${member.Id}`)
        }
        preparedMembers.push({
          rockMembershipId: member.Id, rockGroupId: group.Id, rockGroupName: group.Name,
          rockPersonId: durableId(member.PersonId), ...personDetails(member.Person, member.PersonId),
          lastSyncedAt: syncedAt,
        })
      }
    }

    const payload = await getPayloadClient()
    const transactionID = await payload.db.beginTransaction()
    if (transactionID === null || transactionID === undefined) {
      throw new Error('Reimbursement directory sync requires database transactions')
    }
    const req = { transactionID } as PayloadRequest
    let created = 0
    let updated = 0
    let deleted = 0
    try {
      const existingCentres = await payload.find({
        collection: 'responsibility-centres', depth: 0, pagination: false, limit: 0,
        where: { isLocal: { not_equals: true } },
        select: { rockId: true, isActive: true }, req,
      })
      if (centres.length === 0 && existingCentres.docs.length > 0) {
        throw new Error('Rock returned an empty responsibility centre snapshot; retaining the directory')
      }
      const previousActiveCount = existingCentres.docs.filter(centre => centre.isActive).length
      if (previousActiveCount >= 10 && centres.length / previousActiveCount <= 0.5) {
        throw new Error('Rock returned an implausible responsibility centre snapshot drop; retaining the directory')
      }
      const centreIds = new Map(existingCentres.docs.map(centre => [centre.rockId, centre.id]))
      for (const data of preparedCentres) {
        const id = centreIds.get(data.rockId)
        if (id === undefined) {
          await payload.create({ collection: 'responsibility-centres', data, req })
          created++
        } else {
          await payload.update({ collection: 'responsibility-centres', id, data, req })
          updated++
        }
        centreIds.delete(data.rockId)
      }
      // Preserve durable centre IDs for future report history, but revoke current assignment.
      for (const id of centreIds.values()) {
        await payload.update({
          collection: 'responsibility-centres', id, req,
          data: {
            isActive: false, approverPersonAliasGuid: null, approverRockPersonId: null,
            approverName: null, approverEmail: null, lastSyncedAt: syncedAt,
          },
        })
        updated++
      }

      const existingMembers = await payload.find({
        collection: 'reimbursement-finance-members', depth: 0, pagination: false, limit: 0,
        select: { rockMembershipId: true }, req,
      })
      const memberIds = new Map(existingMembers.docs.map(member => [member.rockMembershipId, member.id]))
      for (const data of preparedMembers) {
        const id = memberIds.get(data.rockMembershipId)
        if (id === undefined) {
          await payload.create({ collection: 'reimbursement-finance-members', data, req })
          created++
        } else {
          await payload.update({ collection: 'reimbursement-finance-members', id, data, req })
          updated++
        }
        memberIds.delete(data.rockMembershipId)
      }
      // An authenticated empty finance membership list must revoke previous memberships.
      for (const id of memberIds.values()) {
        await payload.delete({ collection: 'reimbursement-finance-members', id, req })
        deleted++
      }
      await payload.db.commitTransaction(transactionID)
      Object.assign(result, { created, updated, deleted })
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      throw error
    }
  } catch (error) {
    result.errors.push(String(error))
  }
  return result
}
