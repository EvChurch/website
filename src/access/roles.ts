import type { Access, FieldAccess } from 'payload'
import type { User } from '@/payload-types'

export const payloadAdminRoles = ['admin', 'content-lead', 'editor'] as const

export function hasPayloadAdminRole(user: Pick<User, 'roles'> | null | undefined) {
  return Boolean(user?.roles?.some((role) => payloadAdminRoles.includes(role)))
}

export const isAdmin: Access = ({ req: { user } }) => {
  return Boolean((user as User | null)?.roles?.includes('admin'))
}

export const isContentLead: Access = ({ req: { user } }) => {
  const u = user as User | null
  return Boolean(u?.roles?.includes('admin') || u?.roles?.includes('content-lead'))
}

export const isEditor: Access = ({ req: { user } }) => {
  return hasPayloadAdminRole(user as User | null)
}

export const publishedOnly: Access = ({ req: { user } }) => {
  if (hasPayloadAdminRole(user as User | null)) return true
  return { _status: { equals: 'published' } }
}

export const adminOnlyField: FieldAccess = ({ req: { user } }) => {
  return Boolean((user as User | null)?.roles?.includes('admin'))
}
