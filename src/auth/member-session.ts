import type { SessionData } from '@auth0/nextjs-auth0/types'

import type { RockMemberProfile } from './rock-member-profile'

const MEMBER_PROFILE_MARKER_VERSION = 1 as const
const MAX_NAME_LENGTH = 300
const MAX_EMAIL_LENGTH = 320
const MAX_PHOTO_REFERENCE_LENGTH = 2_048
const controlCharacters = /[\u0000-\u001f\u007f]/u

interface ResolvedMemberMarker {
  version: typeof MEMBER_PROFILE_MARKER_VERSION
  status: 'resolved'
  profile: RockMemberProfile
}

interface UnresolvedMemberMarker {
  version: typeof MEMBER_PROFILE_MARKER_VERSION
  status: 'unresolved'
}

export type MemberProfileMarker =
  | ResolvedMemberMarker
  | UnresolvedMemberMarker

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRequiredText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    value.trim() === value &&
    !controlCharacters.test(value)
  )
}

function isPhotoReference(value: unknown): value is string | null {
  return (
    value === null ||
    (isRequiredText(value, MAX_PHOTO_REFERENCE_LENGTH) && value.length > 0)
  )
}

function isRockMemberProfile(value: unknown): value is RockMemberProfile {
  if (!isRecord(value)) return false

  return (
    typeof value.personId === 'number' &&
    Number.isInteger(value.personId) &&
    value.personId > 0 &&
    isRequiredText(value.name, MAX_NAME_LENGTH) &&
    isRequiredText(value.email, MAX_EMAIL_LENGTH) &&
    isPhotoReference(value.photoUrl)
  )
}

export function createResolvedMemberMarker(
  profile: RockMemberProfile,
): ResolvedMemberMarker {
  return {
    version: MEMBER_PROFILE_MARKER_VERSION,
    status: 'resolved',
    profile: {
      personId: profile.personId,
      name: profile.name,
      email: profile.email,
      photoUrl: profile.photoUrl,
    },
  }
}

export function createUnresolvedMemberMarker(): UnresolvedMemberMarker {
  return { version: MEMBER_PROFILE_MARKER_VERSION, status: 'unresolved' }
}

export function getMemberProfileFromSession(
  session: unknown,
): RockMemberProfile | null {
  if (!isRecord(session)) return null

  const marker = session.rockProfile
  if (
    !isRecord(marker) ||
    marker.version !== MEMBER_PROFILE_MARKER_VERSION ||
    marker.status !== 'resolved' ||
    !isRockMemberProfile(marker.profile)
  ) {
    return null
  }

  return {
    personId: marker.profile.personId,
    name: marker.profile.name,
    email: marker.profile.email,
    photoUrl: marker.profile.photoUrl,
  }
}

export async function getCurrentMemberProfile(): Promise<RockMemberProfile | null> {
  try {
    const { getMemberAuth0Client } = await import('./member-auth0-client')
    const session: SessionData | null =
      await getMemberAuth0Client().getSession()
    return getMemberProfileFromSession(session)
  } catch {
    return null
  }
}
