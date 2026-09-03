import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { formatReadingDate, getLatestDailyReading } from '@/lib/daily-readings/data'
import { getMemberPortalHome } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Members',
  robots: { index: false, follow: false },
}

export default async function MembersPage() {
  const home = await getMemberPortalHome()
  if (!home) redirect('/auth/login?returnTo=%2Fmembers')
  const latestReading = await getLatestDailyReading()

  return (
    <MemberPortalChrome
      active="overview"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(home.groups)}
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/members/daily-readings"
          rel="nofollow"
          className="group flex min-h-64 flex-col justify-between rounded-2xl border border-warm-grey bg-white p-7 shadow-lg shadow-brand-black/5 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Daily Bible Reading</p>
            <h2 className="mt-5 text-3xl leading-tight text-brand-black">Make space for God’s word</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-mid-grey">
              Read today’s passage, reflect on what it means, and pray in response.
            </p>
          </div>
          <div className="mt-8">
            {latestReading && (
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-mid-grey">
                {formatReadingDate(latestReading.sourceDate)} · {latestReading.passageReference}
              </p>
            )}
            <p className="mt-2 text-sm font-bold text-rich-red">Open Daily Reading</p>
          </div>
        </Link>

        <Link
          href={memberConnectGroupHref(home.groups)}
          rel="nofollow"
          className="group flex min-h-64 flex-col justify-between rounded-2xl bg-rich-red p-7 text-white shadow-lg shadow-rich-red/10 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Connect Group</p>
            <h2 className="mt-5 text-3xl leading-tight text-white">Your Connect Groups</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
              See every group you belong to and connect with the people in them.
            </p>
          </div>
          <p className="mt-8 text-sm font-bold text-white">
            {home.groups.length} {home.groups.length === 1 ? 'group' : 'groups'}
          </p>
        </Link>

        <Link
          href="/members/connect-group-leader-resources"
          rel="nofollow"
          className="group flex min-h-64 flex-col justify-between rounded-2xl border border-warm-grey bg-white p-7 shadow-lg shadow-brand-black/5 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Study Resources</p>
            <h2 className="mt-5 text-3xl leading-tight text-brand-black">Connect Group studies</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-mid-grey">
              Open this week&apos;s guide and recent study material for Connect Groups.
            </p>
          </div>
          <p className="mt-8 text-sm font-bold text-rich-red">Open Study Resources</p>
        </Link>

        <Link
          href="/members/my-service"
          rel="nofollow"
          className="group flex min-h-64 flex-col justify-between rounded-2xl bg-brand-black p-7 text-white shadow-lg shadow-brand-black/10 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-light-red-2">Volunteer self service</p>
            <h2 className="mt-5 text-3xl leading-tight text-white">My Service</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              See scheduling requests that need a response and your confirmed upcoming commitments.
            </p>
          </div>
          <p className="mt-8 text-sm font-bold text-light-red-2">View My Service</p>
        </Link>

        <Link
          href="/members/giving"
          rel="nofollow"
          className="group flex min-h-64 flex-col justify-between rounded-2xl border border-warm-grey bg-white p-7 shadow-lg shadow-brand-black/5 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Giving</p>
            <h2 className="mt-5 text-3xl leading-tight text-brand-black">Manage your giving</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-mid-grey">
              See your online giving history and manage active recurring gifts.
            </p>
          </div>
          <p className="mt-8 text-sm font-bold text-rich-red">Open Giving</p>
        </Link>
      </div>
    </MemberPortalChrome>
  )
}
