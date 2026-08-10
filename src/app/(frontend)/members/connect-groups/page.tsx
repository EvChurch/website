import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ConnectGroupCard } from '@/components/members/ConnectGroupCard'
import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { getMemberPortalHome } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Your Connect Groups',
  robots: { index: false, follow: false },
}

export default async function ConnectGroupsPage() {
  const home = await getMemberPortalHome()
  if (!home) redirect('/auth/login?returnTo=%2Fmembers%2Fconnect-groups')
  if (home.groups.length === 1) {
    redirect(memberConnectGroupHref(home.groups))
  }

  return (
    <MemberPortalChrome active="groups" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Connect Groups</p>
      <h2 className="mt-3 max-w-3xl text-4xl leading-tight text-brand-black sm:text-5xl">Your groups and your people</h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-mid-grey">
        If you belong to more than one active group, you&apos;ll see each one here.
      </p>

      {home.groups.length > 0 ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {home.groups.map((group) => <ConnectGroupCard key={group.rockGroupId} group={group} />)}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-warm-grey bg-white p-8 sm:p-12">
          <h3 className="text-2xl text-brand-black">No active Connect Group found</h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mid-grey">
            When you join a Connect Group, it will appear here after the next Rock update.
          </p>
        </div>
      )}
    </MemberPortalChrome>
  )
}
