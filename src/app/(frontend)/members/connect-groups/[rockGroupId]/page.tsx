import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { MemberAvatar } from '@/components/members/MemberAvatar'
import { MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { getMemberGroupDetail, getMemberPortalHome } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Connect Group',
  robots: { index: false, follow: false },
}

function phoneHref(number: string) {
  return `tel:${number.replace(/[^+\d]/gu, '')}`
}

export default async function ConnectGroupDetailPage({
  params,
}: {
  params: Promise<{ rockGroupId: string }>
}) {
  const { rockGroupId: rawRockGroupId } = await params
  const returnTo = encodeURIComponent(`/members/connect-groups/${rawRockGroupId}`)
  const [home, detail] = await Promise.all([
    getMemberPortalHome(),
    getMemberGroupDetail(Number(rawRockGroupId)),
  ])
  if (!home || !detail) redirect(`/auth/login?returnTo=${returnTo}`)
  if (detail.access === 'denied') notFound()

  const location = [detail.group.locationName, detail.group.locationAddress].filter(Boolean).join(', ')

  return (
    <MemberPortalChrome active="groups" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources}>
      <Link href="/members/connect-groups" className="text-sm font-bold text-rich-red hover:underline">Back to your groups</Link>
      <div className="mt-7 flex flex-col gap-6 border-b border-warm-grey pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            {detail.group.campusName && <span className="rounded-full bg-light-red px-3 py-1 text-xs font-bold text-rich-red">{detail.group.campusName}</span>}
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-dark-grey">{detail.group.roleName}</span>
          </div>
          <h2 className="mt-5 text-4xl leading-tight text-brand-black sm:text-6xl">{detail.group.name}</h2>
          {location && <p className="mt-4 text-sm text-mid-grey">{location}</p>}
        </div>
        <p className="text-sm font-bold text-dark-grey">{detail.people.length} active {detail.people.length === 1 ? 'person' : 'people'}</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {detail.people.map((person) => (
          <article key={person.rockPersonId} className="rounded-2xl border border-warm-grey bg-white p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <MemberAvatar name={person.name} src={person.avatarUrl} size="medium" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-brand-black">{person.name}</h3>
                  {person.isCurrentMember && <span className="rounded-full bg-warm-white px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wide text-dark-grey">You</span>}
                  {person.isLeader && <span className="rounded-full bg-light-red px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wide text-rich-red">Leader</span>}
                </div>
                {!person.isLeader && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-mid-grey">{person.roleName}</p>
                )}
                <div className="mt-5 space-y-2 text-sm">
                  {person.email && <a href={`mailto:${person.email}`} className="block break-all font-semibold text-rich-red hover:underline">{person.email}</a>}
                  {person.phones.map((phone) => (
                    <div key={`${person.rockPersonId}-${phone.number}`} className="flex flex-wrap items-center gap-2">
                      <a href={phoneHref(phone.number)} className="font-semibold text-brand-black hover:text-rich-red">{phone.number}</a>
                      {phone.isMessagingEnabled && <span className="text-xs text-mid-grey">Text enabled</span>}
                    </div>
                  ))}
                  {!person.email && person.phones.length === 0 && <p className="text-mid-grey">No contact details available.</p>}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </MemberPortalChrome>
  )
}
