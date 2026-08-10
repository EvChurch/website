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

export default async function MembersPage() {
  const home = await getMemberPortalHome()
  if (!home) redirect('/auth/login?returnTo=%2Fmembers')

  return (
    <MemberPortalChrome
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/members/connect-groups"
          className="group flex min-h-72 flex-col justify-between rounded-2xl bg-rich-red p-8 text-white shadow-lg shadow-rich-red/10 transition-transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          <div>
            <h2 className="text-4xl leading-tight text-white">Your Connect Groups</h2>
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
              <h2 className="mt-5 text-4xl leading-tight text-white">Connect Group Leader Resources</h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                This week&apos;s guide, upcoming studies, videos, notes, and member material.
              </p>
            </div>
            <p className="mt-8 text-sm font-bold text-light-red-2">Open resources</p>
          </Link>
        )}
      </div>
    </MemberPortalChrome>
  )
}
