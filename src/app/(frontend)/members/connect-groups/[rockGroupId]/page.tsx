import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LeaderResourceThisWeek } from '@/components/members/LeaderResourceTimeline'
import {
  ConnectGroupAttendanceSummary,
  ConnectGroupAttendanceTrend,
  ConnectGroupRoster,
} from '@/components/members/ConnectGroupRoster'
import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import {
  getGroupCurrentResources,
  getMemberGroupDetail,
  getMemberPortalHome,
} from '@/lib/members/data'
import { trackedNotFound } from '@/lib/tracked-not-found'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Connect Group',
  robots: { index: false, follow: false },
}

export default async function ConnectGroupDetailPage({
  params,
}: {
  params: Promise<{ rockGroupId: string }>
}) {
  const { rockGroupId: rawRockGroupId } = await params
  const returnTo = encodeURIComponent(`/members/connect-groups/${rawRockGroupId}`)
  const [home, detail] = await Promise.all([
    getMemberPortalHome(),
    getMemberGroupDetail(Number(rawRockGroupId)),
  ])
  if (!home || !detail) redirect(`/auth/login?returnTo=${returnTo}`)
  if (detail.access === 'denied') {
    trackedNotFound('members', 'connect-groups', rawRockGroupId)
  }

  const audience = home.canAccessLeaderResources ? 'leader' : 'member'
  const resources = await getGroupCurrentResources(
    detail.group.rockGroupId,
    detail.group.campusSlug,
    audience,
  )
  const currentResources = resources?.access === 'granted' ? resources.current : []
  const location = [detail.group.locationName, detail.group.locationAddress].filter(Boolean).join(', ')

  return (
    <MemberPortalChrome active="groups" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
      {home.groups.length > 1 && (
        <Link href="/members/connect-groups" rel="nofollow" className="text-sm font-bold text-rich-red hover:underline">Back to your groups</Link>
      )}
      <div className={`${home.groups.length > 1 ? 'mt-7 ' : ''}pb-10`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-4xl leading-tight text-brand-black sm:text-6xl">{detail.group.name}</h2>
            {location && <p className="mt-4 text-sm text-mid-grey">{location}</p>}
          </div>
          {detail.attendance && <ConnectGroupAttendanceSummary attendance={detail.attendance} />}
        </div>
      </div>

      {currentResources.length > 0 && (
        <LeaderResourceThisWeek
          current={currentResources}
          audience={audience}
        />
      )}

      <ConnectGroupRoster people={detail.people} attendance={detail.attendance} />
      {detail.attendance && <ConnectGroupAttendanceTrend attendance={detail.attendance} />}
    </MemberPortalChrome>
  )
}
