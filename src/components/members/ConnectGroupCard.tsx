import Link from 'next/link'

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
}: {
  group: MemberGroupSummary
  highlighted?: boolean
}) {
  const location = [group.locationName, group.locationAddress].filter(Boolean).join(', ')

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
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${highlighted ? 'bg-white/15 text-white' : 'bg-light-red text-rich-red'}`}>
            {group.isLeader ? 'Leader' : group.roleName}
          </span>
          <span className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${highlighted ? 'bg-white/15 group-hover:bg-brand-black' : 'bg-brand-black group-hover:bg-rich-red'}`}>
            <ArrowIcon />
          </span>
        </div>
        <h2 className={`mt-8 text-3xl leading-tight ${highlighted ? 'text-white' : 'text-brand-black'}`}>{group.name}</h2>
      </div>
      <div className={`mt-8 space-y-1 text-sm ${highlighted ? 'text-white/70' : 'text-mid-grey'}`}>
        {group.campusName && <p className={`font-semibold ${highlighted ? 'text-white' : 'text-dark-grey'}`}>{group.campusName}</p>}
        {location && <p>{location}</p>}
      </div>
    </Link>
  )
}
