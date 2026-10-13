import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HiCheckCircle, HiClipboardDocumentCheck, HiUserGroup } from 'react-icons/hi2'

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
  searchParams,
}: {
  params: Promise<{ rockGroupId: string }>
  searchParams?: Promise<{ attendance?: string }>
}) {
  const { rockGroupId: rawRockGroupId } = await params
  const query = await searchParams
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
      {query?.attendance === 'saved' && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-newish-green/30 bg-newish-green/10 px-4 py-3 text-sm font-semibold text-brand-black">
          <HiCheckCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-newish-green" />
          <p>Attendance saved successfully.</p>
        </div>
      )}
      {home.groups.length > 1 && (
        <Link href="/members/connect-groups" rel="nofollow" className="text-sm font-bold text-rich-red hover:underline">Back to your groups</Link>
      )}
      <div className={`${home.groups.length > 1 ? 'mt-7 ' : ''}pb-8`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-4xl leading-tight text-brand-black sm:text-6xl">{detail.group.name}</h2>
            {location && <p className="mt-4 text-sm text-mid-grey">{location}</p>}
            {(detail.group.isLeader || detail.group.isCoach) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.group.isLeader && (
                  <Link
                    href={`/members/connect-groups/${detail.group.rockGroupId}/attendance`}
                    rel="nofollow"
                    className="inline-flex items-center gap-2 rounded-lg bg-rich-red px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-black"
                  >
                    <HiClipboardDocumentCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
                    Record attendance
                  </Link>
                )}
                <Link
                  href={`/members/connect-groups/${detail.group.rockGroupId}/coaching`}
                  rel="nofollow"
                  className="inline-flex items-center gap-2 rounded-lg border border-brand-black bg-white px-5 py-3 text-sm font-bold text-brand-black transition-colors hover:bg-brand-black hover:text-white"
                >
                  <HiUserGroup aria-hidden="true" className="h-5 w-5 shrink-0" />
                  Coaching
                </Link>
              </div>
            )}
          </div>
          {detail.attendance && <ConnectGroupAttendanceSummary attendance={detail.attendance} />}
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <Link
          href="/members/connect-group-leader-resources"
          rel="nofollow"
          className="text-sm font-bold text-rich-red hover:underline"
        >
          Browse other studies
        </Link>
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
