import type { SessionData } from '@auth0/nextjs-auth0/types'

import type { RockMemberProfile } from './rock-member-profile'

const LEGACY_MEMBER_PROFILE_MARKER_VERSIONS = [1, 2] as const
const MEMBER_PROFILE_MARKER_VERSION = 3 as const
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

export interface CurrentMemberProfileState {
  profile: RockMemberProfile
  needsRefresh: boolean
}

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
    isRequiredText(value, MAX_PHOTO_REFERENCE_LENGTH)
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
    isPhotoReference(value.photoUrl) &&
    (
      value.campusSlug === undefined ||
      value.campusSlug === null ||
      ['north', 'central', 'unichurch'].includes(value.campusSlug as string)
    )
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
      campusSlug: profile.campusSlug ?? null,
    },
  }
}

export function createUnresolvedMemberMarker(): UnresolvedMemberMarker {
  return { version: MEMBER_PROFILE_MARKER_VERSION, status: 'unresolved' }
}

export function getMemberProfileFromSession(
  session: unknown,
): RockMemberProfile | null {
  return getMemberProfileFromSessionVersion(
    session,
    MEMBER_PROFILE_MARKER_VERSION,
  )
}

function getMemberProfileFromSessionVersion(
  session: unknown,
  version:
    | (typeof LEGACY_MEMBER_PROFILE_MARKER_VERSIONS)[number]
    | typeof MEMBER_PROFILE_MARKER_VERSION,
): RockMemberProfile | null {
  if (!isRecord(session)) return null

  const marker = session.rockProfile
  if (
    !isRecord(marker) ||
    marker.version !== version ||
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
    campusSlug:
      typeof marker.profile.campusSlug === 'string'
        ? marker.profile.campusSlug
        : null,
  }
}

async function readCurrentMemberSession() {
  const { getAuth0Client } = await import('./auth0-client')
  const auth0 = getAuth0Client()
  const session: SessionData | null = await auth0.getSession()
  const currentProfile = getMemberProfileFromSession(session)
  if (currentProfile && session) {
    return { auth0, session, profile: currentProfile, needsRefresh: false }
  }

  const legacyProfile = LEGACY_MEMBER_PROFILE_MARKER_VERSIONS
    .map((version) => getMemberProfileFromSessionVersion(session, version))
    .find((profile) => profile !== null) ?? null
  if (!legacyProfile || !session || !session.user.sub) return null

  return { auth0, session, profile: legacyProfile, needsRefresh: true }
}

export async function getCurrentMemberProfileState(): Promise<CurrentMemberProfileState | null> {
  try {
    const current = await readCurrentMemberSession()
    return current
      ? { profile: current.profile, needsRefresh: current.needsRefresh }
      : null
  } catch {
    return null
  }
}

export async function getCurrentMemberProfile(
  options: { persistLegacyProfile?: boolean } = {},
): Promise<RockMemberProfile | null> {
  try {
    const current = await readCurrentMemberSession()
    if (!current || !current.needsRefresh || !options.persistLegacyProfile) {
      return current?.profile ?? null
    }

    const { resolveRockMemberProfile } = await import('./rock-member-profile')
    const resolution = await resolveRockMemberProfile(current.session.user.sub)
    if (!resolution.ok) {
      return ['malformed-response', 'upstream-unavailable'].includes(
        resolution.reason,
      )
        ? current.profile
        : null
    }
    if (resolution.profile.personId !== current.profile.personId) return null

    try {
      await current.auth0.updateSession({
        ...current.session,
        rockProfile: createResolvedMemberMarker(resolution.profile),
      })
    } catch {
      console.warn('Member profile session upgrade failed', {
        reason: 'session-update-failed',
      })
    }

    return resolution.profile
  } catch {
    return null
  }
}
