import type { RockGroupMember } from '@/lib/rock-api'
import { getRockPersonName } from './person'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Rock group IDs mapped to team categories
const TEAM_GROUP_MAP: Record<number, 'staff' | 'leadership' | 'apprentices'> = {
  29482: 'staff',
  29485: 'leadership',
  29486: 'apprentices',
}

export function mapRockTeamMember(
  member: RockGroupMember,
  groupId: number,
) {
  const fullName = getRockPersonName(member.Person)

  return {
    fullName,
    slug: slugify(fullName),
    rockPersonId: member.Person.Id,
    role: member.GroupRole.Name,
    email: member.Person.Email || '',
    teamGroup: TEAM_GROUP_MAP[groupId] || 'staff',
    order: member.GroupOrder ?? 0,
    // Photo URL for image sync pipeline
    _photoUrl: member.Person.PhotoUrl || null,
    lastSyncedAt: new Date().toISOString(),
  }
}

export const TEAM_GROUP_IDS = Object.keys(TEAM_GROUP_MAP).map(Number)
