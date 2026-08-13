import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LeaderResourceTimeline } from '@/components/members/LeaderResourceTimeline'
import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { getMemberPortalHome, getMemberResources } from '@/lib/members/data'
import { trackedNotFound } from '@/lib/tracked-not-found'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Connect Group Leader Resources',
  robots: { index: false, follow: false },
}

export default async function LeaderResourcesPage() {
  const [home, result] = await Promise.all([
    getMemberPortalHome(),
    getMemberResources(),
  ])
  if (!home || !result) {
    redirect('/auth/login?returnTo=%2Fmembers%2Fconnect-group-leader-resources')
  }
  if (result.access === 'denied') {
    trackedNotFound('members', 'connect-group-leader-resources')
  }

  return (
    <MemberPortalChrome active="resources" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
      <LeaderResourceTimeline
        current={result.current}
        upcoming={result.upcoming}
        history={result.history}
      />
    </MemberPortalChrome>
  )
}
