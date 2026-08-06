import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getAuth0SessionFromHeaders } from '@/auth/auth0-session'
import { getPayloadClient } from '@/lib/payload'
import { resolveAuth0User } from '@/auth/resolve-auth0-user'
import { hasPayloadAdminRole } from '@/access/roles'

export default async function Auth0BeforeLogin() {
  const requestHeaders = await headers()
  const identity = await getAuth0SessionFromHeaders(requestHeaders)
  if (!identity) redirect('/auth/login?returnTo=/admin')

  const payload = await getPayloadClient()
  const user = await resolveAuth0User(payload, identity)
  if (!hasPayloadAdminRole(user)) redirect('/auth/pending?returnTo=/admin')
  redirect('/admin')
}
