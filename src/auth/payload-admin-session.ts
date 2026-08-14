import { hasExactPayloadAdminRole } from '@/access/roles'
import type { User } from '@/payload-types'

export async function isCurrentPayloadAdmin(headers: Headers) {
  try {
    const { getPayloadClient } = await import('@/lib/payload')
    const payload = await getPayloadClient()
    const { user } = await payload.auth({ headers })
    return hasExactPayloadAdminRole(user as User | null)
  } catch {
    return false
  }
}
