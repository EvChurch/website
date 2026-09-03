import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { SessionData } from '@auth0/nextjs-auth0/types'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import {
  memberConnectGroupHref,
  MemberPortalChrome,
} from '@/components/members/MemberPortalChrome'
import { MemberGiving } from '@/components/members/MemberGiving'
import { getMemberGivingOverview, resolveMemberGivingActor } from '@/lib/members/giving'
import { getMemberPortalHomeForProfile } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Giving',
  robots: { index: false, follow: false },
}

export default async function MemberGivingPage() {
  let session: SessionData | null
  try {
    session = await getAuth0Client().getSession()
  } catch {
    redirect('/auth/login?returnTo=%2Fmembers%2Fgiving')
  }
  const profileState = getMemberProfileStateFromSession(session)
  if (!session?.user.sub || !profileState) {
    redirect('/auth/login?returnTo=%2Fmembers%2Fgiving')
  }

  const [home, actor] = await Promise.all([
    getMemberPortalHomeForProfile(profileState.profile),
    resolveMemberGivingActor(session.user.sub),
  ])
  const overview = await getMemberGivingOverview(actor)

  return (
    <MemberPortalChrome
      active="giving"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(home.groups)}
    >
      <MemberGiving initialOverview={overview} />
    </MemberPortalChrome>
  )
}
