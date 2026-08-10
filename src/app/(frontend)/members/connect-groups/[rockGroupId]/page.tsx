import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { LeaderResourceThisWeek } from '@/components/members/LeaderResourceTimeline'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import {
  getGroupCurrentResources,
  getMemberGroupDetail,
  getMemberPortalHome,
} from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Connect Group',
  robots: { index: false, follow: false },
}

function phoneHref(number: string) {
  return `tel:${number.replace(/[^+\d]/gu, '')}`
}

function smsHref(number: string) {
  return `sms:${number.replace(/[^+\d]/gu, '')}`
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75 12 13l9-6.25M4.5 19.5h15A1.5 1.5 0 0 0 21 18V6a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 0 0-1.173.417l-.97 1.293a1.125 1.125 0 0 1-1.21.38 12.035 12.035 0 0 1-7.143-7.143 1.125 1.125 0 0 1 .38-1.21l1.293-.97c.37-.277.527-.756.417-1.173L6.963 3.102A1.125 1.125 0 0 0 5.872 2.25H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-4.555-1.11L3 20.25l1.327-3.317A7.777 7.777 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
}

function ContactAction({
  href,
  label,
  title,
  children,
}: {
  href: string | null
  label: string
  title: string
  children: ReactNode
}) {
  const className = 'inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors'
  if (!href) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${label} unavailable`}
        title={title}
        className={`${className} cursor-not-allowed bg-[#f2efeb] text-mid-grey/35`}
      >
        {children}
      </button>
    )
  }
  return (
    <a
      href={href}
      aria-label={label}
      title={title}
      className={`${className} bg-warm-white text-brand-black hover:bg-rich-red hover:text-white`}
    >
      {children}
    </a>
  )
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

  const audience = home.canAccessLeaderResources ? 'leader' : 'member'
  const resources = await getGroupCurrentResources(
    detail.group.rockGroupId,
    detail.group.campusSlug,
    audience,
  )
  const currentResources = resources?.access === 'granted' ? resources.current : []
  const location = [detail.group.locationName, detail.group.locationAddress].filter(Boolean).join(', ')

  return (
    <MemberPortalChrome active="groups" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
      {home.groups.length > 1 && (
        <Link href="/members/connect-groups" className="text-sm font-bold text-rich-red hover:underline">Back to your groups</Link>
      )}
      <div className={`${home.groups.length > 1 ? 'mt-7 ' : ''}pb-10`}>
        <h2 className="text-4xl leading-tight text-brand-black sm:text-6xl">{detail.group.name}</h2>
        {location && <p className="mt-4 text-sm text-mid-grey">{location}</p>}
      </div>

      {currentResources.length > 0 && (
        <LeaderResourceThisWeek
          current={currentResources}
          audience={audience}
        />
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {detail.people.map((person) => {
          const phone = person.phones[0]?.number ?? null
          return (
          <article key={person.rockPersonId} className="rounded-xl border border-warm-grey bg-white p-4">
            <div className="flex items-center gap-3">
              <MemberAvatar name={person.name} src={person.avatarUrl} size="small" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-base font-bold leading-tight text-brand-black">{person.name}</h3>
                  {person.isLeader && <span className="rounded-full bg-light-red px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-rich-red">Leader</span>}
                </div>
              </div>
              <div className="ml-auto flex shrink-0 gap-1.5">
                <ContactAction
                  href={person.email ? `mailto:${person.email}` : null}
                  label={`Email ${person.name}`}
                  title={person.email ?? 'No email address'}
                >
                  <MailIcon />
                </ContactAction>
                <ContactAction
                  href={phone ? phoneHref(phone) : null}
                  label={`Call ${person.name}`}
                  title={phone ?? 'No phone number'}
                >
                  <PhoneIcon />
                </ContactAction>
                <ContactAction
                  href={phone ? smsHref(phone) : null}
                  label={`Text ${person.name}`}
                  title={phone ? `Text ${phone}` : 'No phone number'}
                >
                  <MessageIcon />
                </ContactAction>
              </div>
            </div>
          </article>
          )
        })}
      </div>
    </MemberPortalChrome>
  )
}
