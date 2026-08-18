import Link from 'next/link'

import type { GroupAttendanceOverview } from '@/lib/members/attendance'
import type { MemberGroupSummary } from '@/lib/members/data'

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

export function ConnectGroupCard({
  group,
  highlighted = false,
  attendance = null,
}: {
  group: MemberGroupSummary
  highlighted?: boolean
  attendance?: GroupAttendanceOverview['summary'] | null
}) {
  const location = [group.locationName, group.locationAddress].filter(Boolean).join(', ')
  const role = group.isLeader ? 'Leader' : group.isCoach ? 'Coach' : group.roleName
  const roleClasses = highlighted
    ? 'bg-white text-rich-red'
    : group.isLeader
      ? 'bg-rich-red text-white'
      : group.isCoach
        ? 'bg-brand-black text-white'
        : 'border border-warm-grey bg-warm-white text-dark-grey'

  return (
    <Link
      href={`/members/connect-groups/${group.rockGroupId}`}
      rel="nofollow"
      className={`group flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl border p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-light-red-2 ${
        highlighted
          ? 'border-rich-red bg-rich-red text-white shadow-rich-red/15 hover:border-brand-black hover:shadow-rich-red/20'
          : 'border-warm-grey bg-white hover:border-rich-red/30 hover:shadow-brand-black/5'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-5">
          <span className={`rounded-full px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.1em] ${roleClasses}`}>
            {role}
          </span>
          <span className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${highlighted ? 'bg-white/15 group-hover:bg-brand-black' : 'bg-brand-black group-hover:bg-rich-red'}`}>
            <ArrowIcon />
          </span>
        </div>
        <h2 className={`mt-8 text-3xl leading-tight ${highlighted ? 'text-white' : 'text-brand-black'}`}>{group.name}</h2>
        {attendance && (
          <div
            aria-label={`${group.name} attendance summary`}
            className={`mt-7 border-t pt-4 ${highlighted ? 'border-white/20' : 'border-warm-grey'}`}
          >
            <div className={`grid grid-cols-[1fr_3.5rem_3.5rem] items-end gap-3 pb-1 text-[0.5625rem] font-bold uppercase tracking-wide ${highlighted ? 'text-white/65' : 'text-mid-grey'}`}>
              <span>Attendance</span>
              <span className="text-right">Last 4</span>
              <span className="text-right">YTD</span>
            </div>
            {[
              ['Connect Group', attendance.connectGroup.recentPercentage, attendance.connectGroup.ytdPercentage],
              ['Church', attendance.church.recentPercentage, attendance.church.ytdPercentage],
            ].map(([label, recent, ytd]) => (
              <div key={label} className={`grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-3 border-t py-2 ${highlighted ? 'border-white/15' : 'border-warm-grey'}`}>
                <span className={`text-xs font-bold ${highlighted ? 'text-white' : 'text-brand-black'}`}>{label}</span>
                <span className={`text-right text-sm font-bold ${highlighted ? 'text-white' : 'text-brand-black'}`}>{recent === null ? '—' : `${recent}%`}</span>
                <span className={`text-right text-sm font-bold ${highlighted ? 'text-white' : 'text-brand-black'}`}>{ytd === null ? '—' : `${ytd}%`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={`mt-8 space-y-1 text-sm ${highlighted ? 'text-white/70' : 'text-mid-grey'}`}>
        {group.campusName && <p className={`font-semibold ${highlighted ? 'text-white' : 'text-dark-grey'}`}>{group.campusName}</p>}
        {location && <p>{location}</p>}
      </div>
    </Link>
  )
}
