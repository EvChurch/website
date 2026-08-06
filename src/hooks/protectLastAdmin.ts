import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
} from 'payload'
import { APIError } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import type { User } from '@/payload-types'

const finalAdminLockKey = 1_061_020_026

async function lockAdminRoleChanges(
  req: Parameters<CollectionBeforeChangeHook>[0]['req'],
) {
  const transactionID = await req.transactionID
  const session =
    transactionID === undefined ? undefined : req.payload.db.sessions?.[transactionID]
  if (!session) {
    throw new APIError('Administrator role protection is unavailable.', 503)
  }
  const transaction = session.db as {
    execute(query: ReturnType<typeof sql>): Promise<unknown>
  }
  await transaction.execute(sql`SELECT pg_advisory_xact_lock(${finalAdminLockKey})`)
}

async function adminCount(req: Parameters<CollectionBeforeChangeHook>[0]['req']) {
  const result = await req.payload.count({
    collection: 'users',
    overrideAccess: true,
    req,
    where: { roles: { contains: 'admin' } },
  })
  return result.totalDocs
}

function finalAdminError() {
  return new APIError('You cannot remove the final Payload administrator.', 409)
}

export const protectLastAdminUpdate: CollectionBeforeChangeHook<User> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const removesAdmin =
    operation === 'update' &&
    originalDoc?.roles?.includes('admin') &&
    data.roles !== undefined &&
    (!Array.isArray(data.roles) || !data.roles.includes('admin'))
  if (!removesAdmin) return data

  await lockAdminRoleChanges(req)
  if ((await adminCount(req)) <= 1) {
    throw finalAdminError()
  }
  return data
}

export const protectLastAdminDelete: CollectionBeforeDeleteHook = async ({
  id,
  req,
}) => {
  const user = (await req.payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
    req,
    select: { roles: true },
  })) as User
  if (!user.roles?.includes('admin')) return

  await lockAdminRoleChanges(req)
  if ((await adminCount(req)) <= 1) {
    throw finalAdminError()
  }
}
