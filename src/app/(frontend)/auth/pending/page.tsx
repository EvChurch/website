import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { hasPayloadAdminRole } from '@/access/roles'
import { getAuth0SessionFromHeaders } from '@/auth/auth0-session'
import { safeAdminReturnTo } from '@/auth/safe-admin-return'
import { resolveAuth0User } from '@/auth/resolve-auth0-user'
import { AuthAccessMessage } from '@/components/admin/AuthAccessMessage'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export default async function PendingAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo: requestedReturn } = await searchParams
  const returnTo = safeAdminReturnTo(requestedReturn)
  const identity = await getAuth0SessionFromHeaders(await headers())
  if (!identity) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
  }

  const payload = await getPayloadClient()
  const user = await resolveAuth0User(payload, identity)
  if (hasPayloadAdminRole(user)) redirect(returnTo)

  return (
    <AuthAccessMessage
      eyebrow="Payload access"
      title="Your account is waiting for access"
      primaryHref={`/auth/pending?returnTo=${encodeURIComponent(returnTo)}`}
      primaryLabel="Check access again"
      secondaryHref="/auth/logout?returnTo=/"
      secondaryLabel="Sign out"
    >
      <p>Your Ev Church account is signed in, but it does not have a Payload role yet.</p>
      <p>Ask a Payload administrator to give you access, then check again.</p>
    </AuthAccessMessage>
  )
}
