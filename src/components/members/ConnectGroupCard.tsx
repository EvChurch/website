import Link from 'next/link'

import type { MemberGroupSummary } from '@/lib/members/data'

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

export function ConnectGroupCard({ group }: { group: MemberGroupSummary }) {
  const location = [group.locationName, group.locationAddress].filter(Boolean).join(', ')

  return (
    <Link
      href={`/members/connect-groups/${group.rockGroupId}`}
      rel="nofollow"
      className="group flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl border border-warm-grey bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-rich-red/30 hover:shadow-xl hover:shadow-brand-black/5 focus:outline-none focus:ring-4 focus:ring-light-red-2"
    >
      <div>
        <div className="flex items-start justify-between gap-5">
          <span className="rounded-full bg-light-red px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-rich-red">
            {group.isLeader ? 'Leader' : group.roleName}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-black text-white transition-colors group-hover:bg-rich-red">
            <ArrowIcon />
          </span>
        </div>
        <h2 className="mt-8 text-3xl leading-tight text-brand-black">{group.name}</h2>
      </div>
      <div className="mt-8 space-y-1 text-sm text-mid-grey">
        {group.campusName && <p className="font-semibold text-dark-grey">{group.campusName}</p>}
        {location && <p>{location}</p>}
      </div>
    </Link>
  )
}
