import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  memberConnectGroupHref,
  MemberPortalChrome,
} from '@/components/members/MemberPortalChrome'
import { getLedConnectGroups } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Connect Group Attendance',
  robots: { index: false, follow: false },
}

export default async function ConnectGroupAttendanceResolverPage() {
  const result = await getLedConnectGroups()
  if (!result) {
    redirect('/auth/login?returnTo=%2Fmembers%2Fconnect-groups%2Fattendance')
  }

  if (result.groups.length === 1) {
    redirect(`/members/connect-groups/${result.groups[0].rockGroupId}/attendance`)
  }

  return (
    <MemberPortalChrome
      active="groups"
      member={result.profile}
      canAccessLeaderResources={result.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(result.groups)}
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">
        Connect Group attendance
      </p>
      {result.groups.length > 0 ? (
        <>
          <h2 className="mt-3 max-w-3xl text-4xl leading-tight text-brand-black sm:text-5xl">
            Choose a Connect Group
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-mid-grey">
            Select the group you want to record attendance for.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {result.groups.map((group) => (
              <Link
                key={group.rockGroupId}
                href={`/members/connect-groups/${group.rockGroupId}/attendance`}
                rel="nofollow"
                className="rounded-2xl border border-warm-grey bg-white p-6 transition hover:border-rich-red"
              >
                <h3 className="text-2xl text-brand-black">{group.name}</h3>
                {group.locationName && (
                  <p className="mt-2 text-sm text-mid-grey">{group.locationName}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-warm-grey bg-white p-8 sm:p-12">
          <h2 className="text-3xl text-brand-black">Attendance is unavailable</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mid-grey">
            You need to be an active Connect Group leader to record attendance.
          </p>
        </div>
      )}
    </MemberPortalChrome>
  )
}
