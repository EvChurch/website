import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ConnectGroupAttendanceEditor } from '@/components/members/ConnectGroupAttendanceEditor'
import { getConnectGroupAttendanceEntry } from '@/lib/members/attendance-entry'
import { authorizeConnectGroupAttendanceLeader } from '@/lib/members/data'

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
  const context = await authorizeConnectGroupAttendanceLeader(Number(rawRockGroupId))

  if (!context) redirect(`/auth/login?returnTo=${returnTo}`)
  if (context.access === 'denied') notFound()

  let attendanceEntry = null
  try {
    attendanceEntry = await getConnectGroupAttendanceEntry(
      context.group.rockGroupId,
      context.people.map((person) => person.rockPersonId),
    )
  } catch {
    // Rock remains authoritative; an incomplete read must not create a draft.
  }

  return (
    <main className="min-h-screen bg-warm-white px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/members/connect-groups/${context.group.rockGroupId}`}
          rel="nofollow"
          className="text-sm font-bold text-rich-red hover:underline"
        >
          Back to {context.group.name}
        </Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-rich-red">
          Connect Group
        </p>
        <h1 className="mt-3 text-4xl leading-tight text-brand-black sm:text-5xl">
          Record attendance
        </h1>
        <p className="mt-3 text-lg text-mid-grey">{context.group.name}</p>
        <div className="mt-10">
          {attendanceEntry?.selectedMeeting ? (
            <ConnectGroupAttendanceEditor
              rockGroupId={context.group.rockGroupId}
              meetings={attendanceEntry.meetings}
              initialMeeting={attendanceEntry.selectedMeeting}
              people={context.people.map(({ rockPersonId, name }) => ({
                rockPersonId,
                name,
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
    </main>
  )
}
