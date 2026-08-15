export interface MemberChromeState {
  memberProfile: {
    name: string
    email: string
    avatarUrl: string | null
  } | null
  memberCampusSlug: string | null
  adminHref: string | null
  impersonation: {
    personId: number
    name: string
    email: string
  } | null
}

export const ANONYMOUS_MEMBER_CHROME = {
  memberProfile: null,
  memberCampusSlug: null,
  adminHref: null,
  impersonation: null,
} as const satisfies MemberChromeState

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMemberProfile(value: unknown): value is NonNullable<MemberChromeState['memberProfile']> {
  return isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    (typeof value.avatarUrl === 'string' || value.avatarUrl === null)
}

function isImpersonation(value: unknown): value is NonNullable<MemberChromeState['impersonation']> {
  return isRecord(value) &&
    typeof value.personId === 'number' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string'
}

export function parseMemberChromeState(value: unknown): MemberChromeState | null {
  if (!isRecord(value)) return null

  const profile = value.memberProfile
  const impersonation = value.impersonation
  if (profile !== null && !isMemberProfile(profile)) return null
  if (impersonation !== null && !isImpersonation(impersonation)) return null
  if (
    !(typeof value.memberCampusSlug === 'string' || value.memberCampusSlug === null) ||
    !(typeof value.adminHref === 'string' || value.adminHref === null)
  ) return null

  return {
    memberProfile: profile,
    memberCampusSlug: value.memberCampusSlug,
    adminHref: value.adminHref,
    impersonation,
  }
}

export function isAnonymousMemberChrome(state: MemberChromeState): boolean {
  return state.memberProfile === null &&
    state.memberCampusSlug === null &&
    state.adminHref === null &&
    state.impersonation === null
}
