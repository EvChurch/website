import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { SessionData } from '@auth0/nextjs-auth0/types'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import {
  memberConnectGroupHref,
  MemberPortalChrome,
} from '@/components/members/MemberPortalChrome'
import { VolunteerSchedule } from '@/components/members/VolunteerSchedule'
import { getMemberPortalHomeForProfile } from '@/lib/members/data'
import {
  getVolunteerSchedule,
  getVolunteerScheduleDeclineReasons,
  type VolunteerScheduleResult,
} from '@/lib/members/volunteer-scheduling'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'My Service',
  robots: { index: false, follow: false },
}

const unavailableSchedule: VolunteerScheduleResult = {
  status: 'unavailable',
  reason: 'rock-unavailable',
  requests: [],
  upcoming: [],
  declined: [],
}

export default async function MyServicePage() {
  let session: SessionData | null
  try {
    session = await getAuth0Client().getSession()
  } catch {
    redirect('/auth/login?returnTo=%2Fmembers%2Fmy-service')
  }
  const profileState = getMemberProfileStateFromSession(session)
  if (!session?.user.sub || !profileState) {
    redirect('/auth/login?returnTo=%2Fmembers%2Fmy-service')
  }
  const impersonation = getMemberImpersonationFromSession(session)

  const [home, schedule, declineReasons] = await Promise.all([
    getMemberPortalHomeForProfile(profileState.profile),
    getVolunteerSchedule(profileState.profile.personId).catch(() => unavailableSchedule),
    getVolunteerScheduleDeclineReasons(),
  ])

  return (
    <MemberPortalChrome
      active="service"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(home.groups)}
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 sm:mb-10">
          <h1 className="text-4xl leading-tight text-brand-black sm:text-5xl">My Service</h1>
        </header>

        <VolunteerSchedule
          schedule={schedule}
          declineReasons={declineReasons}
          isImpersonating={impersonation !== null}
        />
      </div>
    </MemberPortalChrome>
  )
}
