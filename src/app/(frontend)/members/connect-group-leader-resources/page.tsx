import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { LeaderResourceCard } from '@/components/members/LeaderResourceCard'
import { MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { getMemberPortalHome, getMemberResources } from '@/lib/members/data'

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
  if (result.access === 'denied') notFound()

  return (
    <MemberPortalChrome active="resources" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">For leaders and coaches</p>
      <h2 className="mt-3 max-w-4xl text-4xl leading-tight text-brand-black sm:text-6xl">Connect Group Leader Resources</h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-mid-grey">
        Weekly videos, notes, member studies, and everything you need to prepare your group.
      </p>

      <section className="mt-14" aria-labelledby="this-week-heading">
        <h3 id="this-week-heading" className="text-3xl text-brand-black">This Week</h3>
        <div className="mt-6 space-y-6">
          {result.current.length > 0 ? result.current.map((resource) => (
            <LeaderResourceCard key={resource.rockId} resource={resource} featured />
          )) : (
            <div className="rounded-2xl border border-warm-grey bg-white p-8 text-sm text-mid-grey">There is no current resource this week.</div>
          )}
        </div>
      </section>

      {result.upcoming.length > 0 && (
        <section className="mt-16" aria-labelledby="coming-up-heading">
          <div className="flex items-end justify-between gap-5">
            <div>
              <h3 id="coming-up-heading" className="text-3xl text-brand-black">Coming Up</h3>
              <p className="mt-2 text-sm text-mid-grey">Open these now and prepare ahead.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {result.upcoming.map((resource) => <LeaderResourceCard key={resource.rockId} resource={resource} />)}
          </div>
        </section>
      )}

      {result.history.length > 0 && (
        <section className="mt-16" aria-labelledby="history-heading">
          <h3 id="history-heading" className="text-3xl text-brand-black">Recent History</h3>
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {result.history.map((resource) => <LeaderResourceCard key={resource.rockId} resource={resource} />)}
          </div>
        </section>
      )}
    </MemberPortalChrome>
  )
}
