import type { Pool } from 'pg'
import type { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { isCurrentPayloadAdmin } from '@/auth/payload-admin-session'
import { getPayloadClient } from '@/lib/payload'
import { isFinance } from './store'
import type { Actor } from './model'

export async function reimbursementPool(): Promise<Pool> {
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as { pool?: Pool }).pool
  if (!pool?.connect) throw new Error('Reimbursements require PostgreSQL')
  return pool
}
export async function reimbursementActor(request?: NextRequest): Promise<Actor | null> {
  const session = await (request ? getAuth0Client().getSession(request) : getAuth0Client().getSession())
  if (!session?.user.sub || getMemberImpersonationFromSession(session)) return null
  const state = getMemberProfileStateFromSession(session)
  if (!state || state.needsRefresh) return null
  const requestHeaders = request?.headers ?? await headers()
  const [admin, finance] = await Promise.all([
    isCurrentPayloadAdmin(requestHeaders), isFinance(await reimbursementPool(), state.profile.personId),
  ])
  return { ...state.profile, admin, finance }
}
