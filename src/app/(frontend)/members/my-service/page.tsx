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
import {
  UnavailabilitySection,
} from '@/components/members/ScheduleUnavailability'
import { VolunteerSchedule } from '@/components/members/VolunteerSchedule'
import { getMemberPortalHomeForProfile } from '@/lib/members/data'
import {
  getVolunteerScheduleDeclineReasons,
  getVolunteerServiceOverview,
  type VolunteerServiceOverview,
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

const unavailableServiceOverview: VolunteerServiceOverview = {
  schedule: unavailableSchedule,
  groups: { status: 'unavailable', groups: [] },
  unavailability: { status: 'unavailable', exclusions: [] },
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

  const [home, service, declineReasons] = await Promise.all([
    getMemberPortalHomeForProfile(profileState.profile),
    getVolunteerServiceOverview(profileState.profile.personId).catch(() => unavailableServiceOverview),
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
          schedule={service.schedule}
          declineReasons={declineReasons}
          isImpersonating={impersonation !== null}
        />
        <UnavailabilitySection
          groups={service.groups.groups}
          groupsUnavailable={service.groups.status === 'unavailable'}
          isImpersonating={impersonation !== null}
          unavailability={service.unavailability}
        />
      </div>
    </MemberPortalChrome>
  )
}
