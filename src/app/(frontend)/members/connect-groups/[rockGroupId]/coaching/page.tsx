import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { HiArrowLeft } from 'react-icons/hi2'

import {
  addConnectGroupCommentAction,
  deleteConnectGroupCommentAction,
  updateConnectGroupCommentAction,
} from '../comment-actions'
import { ConnectGroupComments } from '@/components/members/ConnectGroupComments'
import { MemberContactActions } from '@/components/members/ConnectGroupRoster'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import {
  memberConnectGroupHref,
  MemberPortalChrome,
} from '@/components/members/MemberPortalChrome'
import {
  getMemberGroupCoaching,
  getMemberGroupCommentThread,
  getMemberPortalHome,
} from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Connect Group Coaching',
  robots: { index: false, follow: false },
}

export default async function ConnectGroupCoachingPage({
  params,
  searchParams,
}: {
  params: Promise<{ rockGroupId: string }>
  searchParams?: Promise<{ comment?: string }>
}) {
  const { rockGroupId: rawRockGroupId } = await params
  const query = await searchParams
  const rockGroupId = Number(rawRockGroupId)
  const returnTo = encodeURIComponent(
    `/members/connect-groups/${rawRockGroupId}/coaching`,
  )
  const [home, coaching, commentThread] = await Promise.all([
    getMemberPortalHome(),
    getMemberGroupCoaching(rockGroupId),
    getMemberGroupCommentThread(rockGroupId),
  ])

  if (!home || !coaching || !commentThread) {
    redirect(`/auth/login?returnTo=${returnTo}`)
  }
  if (coaching.access === 'denied' || commentThread.access === 'denied') notFound()

  return (
    <MemberPortalChrome
      active="groups"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(home.groups)}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/members/connect-groups/${coaching.group.rockGroupId}`}
          rel="nofollow"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-rich-red transition-colors hover:text-brand-black hover:underline sm:text-base"
        >
          <HiArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          {coaching.group.name}
        </Link>
        <h1 className="text-4xl leading-tight text-brand-black sm:text-5xl">Coaching</h1>

        <section className="mt-8" aria-label="Coaches and group leaders">
          <div className="overflow-hidden rounded-xl border border-warm-grey bg-white">
            {coaching.people.map((person) => (
              <article
                key={person.rockPersonId}
                className="flex items-center gap-3 border-t border-warm-grey px-4 py-4 first:border-t-0 sm:px-5"
              >
                <MemberAvatar name={person.name} src={person.avatarUrl} size="small" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-tight text-brand-black">{person.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {person.isCoach && (
                      <span className="rounded-full bg-brand-black px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">
                        Coach
                      </span>
                    )}
                    {person.isLeader && (
                      <span className="rounded-full bg-light-red px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-rich-red">
                        Leader
                      </span>
                    )}
                  </div>
                </div>
                <MemberContactActions
                  name={person.name}
                  email={person.email}
                  phone={person.phones[0]?.number ?? null}
                  smsPhone={person.phones.find((phone) => phone.isMessagingEnabled)?.number ?? null}
                />
              </article>
            ))}
          </div>
        </section>

        <ConnectGroupComments
          thread={commentThread}
          action={addConnectGroupCommentAction.bind(null, coaching.group.rockGroupId)}
          updateAction={updateConnectGroupCommentAction.bind(null, coaching.group.rockGroupId)}
          deleteAction={deleteConnectGroupCommentAction.bind(null, coaching.group.rockGroupId)}
          status={query?.comment === 'added' || query?.comment === 'updated' || query?.comment === 'deleted' || query?.comment === 'error' ? query.comment : undefined}
        />
      </div>
    </MemberPortalChrome>
  )
}
