import type { Payload } from 'payload'
import type { Pool } from 'pg'
import { hasExactPayloadAdminRole } from '@/access/roles'
import type { User } from '@/payload-types'
import { resolveRockMemberProfile } from '@/auth/rock-member-profile'

/** Finance access follows the freshly synced Rock membership, never a saved website role. */
export async function isReimbursementFinanceIdentity(payload: Payload, subject: string) {
  const pool = (payload.db as unknown as { pool?: Pool }).pool
  if (!pool || !subject) return false
  const resolution = await resolveRockMemberProfile(subject)
  if (!resolution.ok) return false
  const result = await pool.query(`SELECT 1 FROM reimbursement_finance_members
    WHERE rock_person_id=$1 AND last_synced_at>now()-interval '45 minutes' LIMIT 1`, [resolution.profile.personId])
  return Boolean(result.rowCount)
}
export async function canManageReimbursementSettings(payload: Payload, user: User | null) {
  return Boolean(user && (hasExactPayloadAdminRole(user) || await isReimbursementFinanceIdentity(payload, user.auth0Subject)))
}
