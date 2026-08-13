import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { memberConnectGroupHref, MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { formatResourceDates } from '@/components/members/LeaderResourceCard'
import { LeaderResourceVideoButton } from '@/components/members/LeaderResourceVideoButton'
import { LeaderResourceShareButton } from '@/components/members/LeaderResourceShareButton'
import { getMemberPortalHome, getMemberResourceDetail } from '@/lib/members/data'
import { leaderResourceMedia } from '@/lib/members/leader-resource-media'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Connect Group Leader Resource',
  robots: { index: false, follow: false },
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8m-6-6 6 6m-6-6v6h6M8 14h8m-8 4h5" />
    </svg>
  )
}

export default async function LeaderResourceDetailPage({
  params,
}: {
  params: Promise<{ rockId: string }>
}) {
  const { rockId: rawRockId } = await params
  const returnTo = encodeURIComponent(`/members/connect-group-leader-resources/${rawRockId}`)
  const [home, result] = await Promise.all([
    getMemberPortalHome(),
    getMemberResourceDetail(Number(rawRockId)),
  ])
  if (!home || !result) redirect(`/auth/login?returnTo=${returnTo}`)
  if (result.access === 'denied') notFound()

  const resource = result.resource
  const dates = formatResourceDates(resource)
  const video = leaderResourceMedia(resource)
  const hosts = resource.hosts.map((host) => host.name).join(' & ')

  return (
    <MemberPortalChrome active="resources" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
      <Link href="/members/connect-group-leader-resources" rel="nofollow" className="text-sm font-bold text-rich-red hover:underline">Back to all resources</Link>

      <section className="mt-6 overflow-hidden rounded-xl shadow-xl shadow-brand-black/10">
        <div className="relative overflow-hidden bg-rich-red text-white">
          {resource.promotionalImageUrl && (
            <div className="relative aspect-video w-full overflow-hidden bg-brand-black lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-1/2 lg:aspect-auto">
              {/* Public, same-origin route so Next can optimize the artwork. */}
              <Image
                src={resource.promotionalImageUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain"
              />
            </div>
          )}
          <header className={`relative px-6 py-8 sm:px-9 sm:py-10 ${resource.promotionalImageUrl ? 'lg:pr-[52%]' : ''}`}>
            {dates && (
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">{dates}</p>
            )}
            <h2 className={dates ? 'mt-3 text-4xl leading-none text-white sm:text-5xl' : 'text-4xl leading-none text-white sm:text-5xl'}>{resource.title}</h2>
            {(resource.bibleReference || hosts) && (
              <p className="mt-4 text-sm text-white/80">
                {[resource.bibleReference, hosts].filter(Boolean).join(' · ')}
              </p>
            )}
            {resource.description && (
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85">{resource.description}</p>
            )}
            {(video || resource.hasLeaderNotes || resource.hasMemberStudy) && (
              <div className="mt-7 flex flex-wrap gap-3">
                {video && <LeaderResourceVideoButton media={video} variant="featured" size="sm" />}
                {resource.hasLeaderNotes && (
                  <a
                    href={`/members/connect-group-leader-resources/${resource.rockId}/files/leader-notes`}
                    rel="nofollow"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-white/60 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                  >
                    <FileIcon /> Notes
                  </a>
                )}
                {resource.hasMemberStudy && (
                  <a
                    href={`/members/connect-group-leader-resources/${resource.rockId}/files/member-study`}
                    rel="nofollow"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-white/60 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                  >
                    <FileIcon /> Study
                  </a>
                )}
                {(video || resource.hasLeaderNotes) && (
                  <LeaderResourceShareButton
                    rockId={resource.rockId}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-white/60 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                  />
                )}
              </div>
            )}
          </header>
        </div>
      </section>
    </MemberPortalChrome>
  )
}
