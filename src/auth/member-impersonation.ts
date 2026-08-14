import type { SessionData } from '@auth0/nextjs-auth0/types'

import type { RockMemberProfile } from './rock-member-profile'
import {
  createResolvedMemberMarker,
  createUnresolvedMemberMarker,
  getMemberProfileFromSession,
  getMemberProfileStateFromSession,
} from './member-session'

const IMPERSONATION_VERSION = 1 as const

interface MemberImpersonationMarker {
  version: typeof IMPERSONATION_VERSION
  status: 'active'
  originalHadRockProfile: boolean
  originalRockProfile: unknown
  targetProfile: RockMemberProfile
}

export interface MemberImpersonationDisplay {
  personId: number
  name: string
  email: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizedProfile(profile: RockMemberProfile) {
  const marker = createResolvedMemberMarker(profile)
  return getMemberProfileFromSession({ rockProfile: marker })
}

function normalizedOriginalRockProfile(session: SessionData) {
  if (!Object.prototype.hasOwnProperty.call(session, 'rockProfile')) {
    return { had: false, marker: null }
  }

  const profileState = getMemberProfileStateFromSession(session)
  if (profileState) {
    return { had: true, marker: createResolvedMemberMarker(profileState.profile) }
  }

  const raw = session.rockProfile
  if (
    isRecord(raw) &&
    raw.version === 3 &&
    raw.status === 'unresolved'
  ) {
    return { had: true, marker: createUnresolvedMemberMarker() }
  }

  return { had: false, marker: null }
}

function parseMarker(session: unknown): MemberImpersonationMarker | null {
  if (!isRecord(session)) return null
  const marker = session.memberImpersonation
  if (
    !isRecord(marker) ||
    marker.version !== IMPERSONATION_VERSION ||
    marker.status !== 'active' ||
    typeof marker.originalHadRockProfile !== 'boolean'
  ) {
    return null
  }

  const targetProfile = normalizedProfile(marker.targetProfile as RockMemberProfile)
  const activeProfile = getMemberProfileFromSession(session)
  if (
    !targetProfile ||
    !activeProfile ||
    activeProfile.personId !== targetProfile.personId ||
    activeProfile.email !== targetProfile.email
  ) {
    return null
  }

  return {
    version: IMPERSONATION_VERSION,
    status: 'active',
    originalHadRockProfile: marker.originalHadRockProfile,
    originalRockProfile: marker.originalRockProfile,
    targetProfile,
  }
}

export function getMemberImpersonationFromSession(
  session: unknown,
): MemberImpersonationDisplay | null {
  const marker = parseMarker(session)
  return marker
    ? {
        personId: marker.targetProfile.personId,
        name: marker.targetProfile.name,
        email: marker.targetProfile.email,
      }
    : null
}

export async function getCurrentMemberImpersonation() {
  try {
    const { getAuth0Client } = await import('./auth0-client')
    const session = await getAuth0Client().getSession()
    return getMemberImpersonationFromSession(session)
  } catch {
    return null
  }
}

export function startMemberImpersonation(
  session: SessionData,
  target: RockMemberProfile,
): SessionData | null {
  if (
    !isRecord(session.user) ||
    typeof session.user.sub !== 'string' ||
    !session.user.sub ||
    Object.prototype.hasOwnProperty.call(session, 'memberImpersonation')
  ) {
    return null
  }

  const targetProfile = normalizedProfile(target)
  if (!targetProfile) return null
  const original = normalizedOriginalRockProfile(session)

  return {
    ...session,
    rockProfile: createResolvedMemberMarker(targetProfile),
    memberImpersonation: {
      version: IMPERSONATION_VERSION,
      status: 'active',
      originalHadRockProfile: original.had,
      originalRockProfile: original.marker,
      targetProfile,
    } satisfies MemberImpersonationMarker,
  }
}

export function stopMemberImpersonation(session: SessionData): SessionData | null {
  const marker = parseMarker(session)
  if (!marker) return null

  const { memberImpersonation: _removed, rockProfile: _active, ...rest } = session
  return marker.originalHadRockProfile
    ? { ...rest, rockProfile: marker.originalRockProfile }
    : rest
}
