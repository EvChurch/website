import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DailyReadingEmailSignup } from '@/components/daily-readings/DailyReadingEmailSignup'
import { ReadingHubClient } from '@/components/daily-readings/ReadingHubClient'
import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { getPublishedDailyReadings } from '@/lib/daily-readings/data'
import { isDailyReadingEmailSubscribed } from '@/lib/daily-readings/email-subscription'
import { getMemberPortalHome } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Daily Bible Reading',
  description: 'Read Scripture, reflect, pray, and keep your place with Ev Church’s daily guided Bible reading.',
  robots: { index: false, follow: false },
}

export default async function MemberDailyReadingsPage() {
  const home = await getMemberPortalHome()
  if (!home) redirect('/auth/login?returnTo=%2Fmembers%2Fdaily-readings')

  const [readings, emailSubscribed] = await Promise.all([
    getPublishedDailyReadings(),
    isDailyReadingEmailSubscribed(home.profile.personId).catch(() => false),
  ])

  return (
    <MemberPortalChrome
      active="reading"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(home.groups)}
    >
      {readings.length > 0 ? (
        <ReadingHubClient readings={readings} />
      ) : (
        <div className="rounded-2xl border border-warm-grey bg-white p-8 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">Daily Bible Reading</p>
          <h2 className="mt-3 text-4xl text-brand-black">The next reading is on its way.</h2>
        </div>
      )}
      <DailyReadingEmailSignup initiallySubscribed={emailSubscribed} />
    </MemberPortalChrome>
  )
}
