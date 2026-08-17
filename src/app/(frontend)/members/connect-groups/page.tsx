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
  const ownGroups = home.groups.filter((group) => !group.isCoached)
  const coachedGroups = home.groups.filter((group) => group.isCoached)

  return (
    <MemberPortalChrome active="groups" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Connect Groups</p>
      <h2 className="mt-3 max-w-3xl text-4xl leading-tight text-brand-black sm:text-5xl">Your groups and your people</h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-mid-grey">
        {coachedGroups.length > 0
          ? 'Your own Connect Group appears first, followed by the groups you coach.'
          : 'If you belong to more than one active group, you\'ll see each one here.'}
      </p>

      {home.groups.length > 0 ? (
        <>
          {ownGroups.length > 0 && (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {ownGroups.map((group) => (
                <ConnectGroupCard
                  key={group.rockGroupId}
                  group={group}
                  highlighted={coachedGroups.length > 0}
                />
              ))}
            </div>
          )}
          {coachedGroups.length > 0 && (
            <section className={ownGroups.length > 0 ? 'mt-14' : 'mt-10'}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">
                Connect Groups I coach
              </p>
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {coachedGroups.map((group) => (
                  <ConnectGroupCard key={group.rockGroupId} group={group} />
                ))}
              </div>
            </section>
          )}
        </>
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
