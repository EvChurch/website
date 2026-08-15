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
  nativeToolboxUrl: null,
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

  const [home, schedule] = await Promise.all([
    getMemberPortalHomeForProfile(profileState.profile),
    getVolunteerSchedule(profileState.profile.personId).catch(() => unavailableSchedule),
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
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Volunteer self service</p>
          <h1 className="mt-3 text-4xl leading-tight text-brand-black sm:text-5xl">My Service</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-mid-grey">
            See requests that need a response and your confirmed upcoming serving commitments.
          </p>
        </header>

        <VolunteerSchedule
          schedule={schedule}
          isImpersonating={impersonation !== null}
        />
      </div>
    </MemberPortalChrome>
  )
}
