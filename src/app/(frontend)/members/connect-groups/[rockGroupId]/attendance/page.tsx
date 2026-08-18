import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { HiArrowLeft } from 'react-icons/hi2'

import { ConnectGroupAttendanceEditor } from '@/components/members/ConnectGroupAttendanceEditor'
import {
  memberConnectGroupHref,
  MemberPortalChrome,
} from '@/components/members/MemberPortalChrome'
import { getConnectGroupAttendanceEntry } from '@/lib/members/attendance-entry'
import {
  authorizeConnectGroupAttendanceLeader,
  getMemberPortalHome,
} from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Record Connect Group Attendance',
  robots: { index: false, follow: false },
}

export default async function ConnectGroupAttendancePage({
  params,
}: {
  params: Promise<{ rockGroupId: string }>
}) {
  const { rockGroupId: rawRockGroupId } = await params
  const returnTo = encodeURIComponent(
    `/members/connect-groups/${rawRockGroupId}/attendance`,
  )
  const [context, home] = await Promise.all([
    authorizeConnectGroupAttendanceLeader(Number(rawRockGroupId)),
    getMemberPortalHome(),
  ])

  if (!context || !home) redirect(`/auth/login?returnTo=${returnTo}`)
  if (context.access === 'denied') notFound()

  let attendanceEntry = null
  try {
    attendanceEntry = await getConnectGroupAttendanceEntry(
      context.group.rockGroupId,
      context.people.map((person) => person.rockPersonId),
    )
  } catch (error) {
    // Rock remains authoritative; an incomplete read must not create a draft.
    console.error({
      category: 'connect-group-attendance-load-failed',
      groupId: context.group.rockGroupId,
      error: error instanceof Error ? error.message : 'Unknown attendance load failure',
    })
  }

  return (
    <MemberPortalChrome
      active="groups"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(home.groups)}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/members/connect-groups/${context.group.rockGroupId}`}
          rel="nofollow"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-rich-red transition-colors hover:text-brand-black hover:underline sm:text-base"
        >
          <HiArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          {context.group.name}
        </Link>
        <h1 className="text-4xl leading-tight text-brand-black sm:text-5xl">
          Record attendance
        </h1>
        <div className="mt-7">
          {attendanceEntry?.selectedMeeting ? (
            <ConnectGroupAttendanceEditor
              rockGroupId={context.group.rockGroupId}
              meetings={attendanceEntry.meetings}
              initialMeeting={attendanceEntry.selectedMeeting}
              people={context.people.map(({ rockPersonId, name, avatarUrl }) => ({
                rockPersonId,
                name,
                avatarUrl,
              }))}
            />
          ) : (
            <div className="rounded-2xl border border-warm-grey bg-white p-8">
              <h2 className="text-2xl text-brand-black">Attendance is unavailable</h2>
              <p className="mt-3 text-sm leading-relaxed text-mid-grey">
                We could not safely load a recent scheduled meeting from Rock. Please try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </MemberPortalChrome>
  )
}
