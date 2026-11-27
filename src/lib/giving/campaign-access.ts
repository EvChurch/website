// First minute of Saturday 5 December 2026 in Pacific/Auckland (NZDT).
export const GIVE_SUNDAY_PUBLIC_OPENS_AT = '2026-12-05T00:00:00+13:00'
export const GIVE_SUNDAY_RETURN_MESSAGE = 'Return on Give Sunday to Give'

export interface CampaignGivingAccess {
  allowed: boolean
  publicAccess: boolean
  opensAt: string
}

export function campaignPublicAccess(now: Date = new Date()): boolean {
  return Number.isFinite(now.getTime()) && now.getTime() >= Date.parse(GIVE_SUNDAY_PUBLIC_OPENS_AT)
}

export function campaignGivingAccess(staffOrExec: boolean, now: Date = new Date()): CampaignGivingAccess {
  const publicAccess = campaignPublicAccess(now)
  return { allowed: publicAccess || staffOrExec, publicAccess, opensAt: GIVE_SUNDAY_PUBLIC_OPENS_AT }
}
