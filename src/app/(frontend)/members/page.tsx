import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { getMemberPortalHome } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Members',
  robots: { index: false, follow: false },
}

const futureAreas = [
  { title: 'Serving', description: 'Your serving teams and upcoming rosters.' },
  { title: 'Registrations', description: 'Events and gatherings you are registered for.' },
  { title: 'Giving', description: 'Your gifts, giving history, and financial details.' },
  { title: 'My details', description: 'The things you like and the details we have for you.' },
]

export default async function MembersPage() {
  const home = await getMemberPortalHome()
  if (!home) redirect('/auth/login?returnTo=%2Fmembers')

  return (
    <MemberPortalChrome
      active="overview"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Your church life</p>
          <h2 className="mt-3 text-4xl leading-tight text-brand-black sm:text-5xl">All in one place</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-mid-grey">
          Start with your people and leader resources. More of your church life will appear here as it becomes available.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/members/connect-groups"
          className="group flex min-h-72 flex-col justify-between rounded-2xl bg-rich-red p-8 text-white shadow-lg shadow-rich-red/10 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Available now</p>
            <h3 className="mt-5 text-4xl leading-tight text-white">Your Connect Groups</h3>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
              See every group you belong to and connect with the people in them.
            </p>
          </div>
          <p className="mt-8 text-sm font-bold">
            {home.groups.length} {home.groups.length === 1 ? 'group' : 'groups'}
          </p>
        </Link>

        {home.canAccessLeaderResources && (
          <Link
            href="/members/connect-group-leader-resources"
            className="group flex min-h-72 flex-col justify-between rounded-2xl bg-brand-black p-8 text-white shadow-lg shadow-brand-black/10 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-light-red-2">For leaders and coaches</p>
              <h3 className="mt-5 text-4xl leading-tight text-white">Connect Group Leader Resources</h3>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                This week&apos;s guide, upcoming studies, videos, notes, and member material.
              </p>
            </div>
            <p className="mt-8 text-sm font-bold text-light-red-2">Open resources</p>
          </Link>
        )}

        {futureAreas.map((area) => (
          <article key={area.title} className="flex min-h-64 flex-col justify-between rounded-2xl border border-warm-grey bg-white p-8">
            <div>
              <span className="rounded-full bg-warm-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-mid-grey">Coming later</span>
              <h3 className="mt-6 text-3xl leading-tight text-brand-black">{area.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-mid-grey">{area.description}</p>
            </div>
          </article>
        ))}
      </div>
    </MemberPortalChrome>
  )
}
