import { getAuth0Client } from './auth0-client'
import { readAuth0Config } from './auth0-config'
import { identityFromSessionUser } from './auth0-identity'
import { safeMemberReturnTo } from './safe-member-return'

export function isCourseReturnTo(value: string | null | undefined) {
  const path = safeMemberReturnTo(value).split('?')[0]
  return path === '/members/courses' || path.startsWith('/members/courses/')
}

/** Course access requires an account, not a Rock profile or CMS role. */
export async function getCurrentCourseIdentity() {
  try {
    const session = await getAuth0Client().getSession()
    return session ? identityFromSessionUser(readAuth0Config().issuer, session.user) : null
  } catch { return null }
}
