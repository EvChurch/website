import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { DailyReadingFlow } from '@/components/daily-readings/DailyReadingFlow'
import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { formatReadingDate, getDailyReadingByRockId } from '@/lib/daily-readings/data'
import { getMemberPortalHome } from '@/lib/members/data'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ readingId: string }> }): Promise<Metadata> {
  const { readingId } = await params
  const rockId = Number(readingId)
  const reading = Number.isInteger(rockId) ? await getDailyReadingByRockId(rockId) : null
  return reading
    ? { title: `${reading.passageReference} | Daily Bible Reading`, robots: { index: false, follow: false } }
    : { robots: { index: false, follow: false } }
}

export default async function MemberDailyReadingPage({ params }: { params: Promise<{ readingId: string }> }) {
  const { readingId } = await params
  const rockId = Number(readingId)
  if (!Number.isInteger(rockId)) notFound()

  const returnTo = encodeURIComponent(`/members/daily-readings/${readingId}`)
  const [home, reading] = await Promise.all([
    getMemberPortalHome(),
    getDailyReadingByRockId(rockId),
  ])
  if (!home) redirect(`/auth/login?returnTo=${returnTo}`)
  if (!reading) notFound()

  return (
    <MemberPortalChrome
      active="reading"
      member={home.profile}
      canAccessLeaderResources={home.canAccessLeaderResources}
      connectGroupHref={memberConnectGroupHref(home.groups)}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/members/daily-readings" className="text-sm font-bold text-rich-red hover:underline">
            ← All readings
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mid-grey">
            {formatReadingDate(reading.sourceDate, { weekday: true })}
          </p>
        </div>
        <DailyReadingFlow reading={reading} />
      </div>
    </MemberPortalChrome>
  )
}
