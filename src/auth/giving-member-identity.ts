import type { SessionData } from '@auth0/nextjs-auth0/types'

import type { GivingRockClient } from '@/lib/giving/rock-client'
import type { GivingIdentityInput } from '@/lib/giving/rock-identity'

export type GivingIdentityField = 'firstName' | 'lastName' | 'email'

export type CurrentGivingMemberIdentity =
  | { signedIn: false }
  | {
      signedIn: true
      personId: number
      personAliasId: number
      firstName: string | null
      lastName: string | null
      email: string | null
      missingFields: GivingIdentityField[]
    }

interface GivingMemberIdentityDependencies {
  getSession?: () => Promise<SessionData | null>
  rockClient: GivingRockClient
}

function usableSubject(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export async function resolveCurrentGivingMemberIdentity({
  getSession,
  rockClient,
}: GivingMemberIdentityDependencies): Promise<CurrentGivingMemberIdentity> {
  const readSession = getSession ?? (async () => {
    const { getAuth0Client } = await import('./auth0-client')
    return getAuth0Client().getSession()
  })
  const session = await readSession()
  const subject = session?.user?.sub
  if (!usableSubject(subject)) return { signedIn: false }

  const person = await rockClient.resolveSignedInPerson(subject)
  const missingFields: GivingIdentityField[] = []
  if (!person.firstName) missingFields.push('firstName')
  if (!person.lastName) missingFields.push('lastName')
  if (!person.email) missingFields.push('email')

  return {
    signedIn: true,
    personId: person.id,
    personAliasId: person.primaryAliasId,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    missingFields,
  }
}

/** Builds submission identity from fresh server-resolved Rock data, accepting only fields Rock lacks. */
export function givingIdentityForMemberSubmission(
  member: Extract<CurrentGivingMemberIdentity, { signedIn: true }>,
  missing: Partial<Record<GivingIdentityField, string>>,
): GivingIdentityInput {
  return {
    kind: 'member',
    personAliasId: member.personAliasId,
    firstName: member.firstName ?? missing.firstName ?? '',
    lastName: member.lastName ?? missing.lastName ?? '',
    email: member.email ?? missing.email ?? '',
  }
}
