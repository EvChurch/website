import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { MemberAvatar } from '@/components/members/MemberAvatar'
import { MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { formatResourceDates } from '@/components/members/LeaderResourceCard'
import { getMemberPortalHome, getMemberResourceDetail } from '@/lib/members/data'
import { youtubeEmbedUrl } from '@/lib/members/youtube'

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
  const embedUrl = youtubeEmbedUrl(resource.youtubeUrl)

  return (
    <MemberPortalChrome active="resources" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources}>
      <Link href="/members/connect-group-leader-resources" className="text-sm font-bold text-rich-red hover:underline">Back to all resources</Link>
      <header className="mt-7 max-w-5xl">
        {dates && <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">{dates}</p>}
        <h2 className="mt-4 text-4xl leading-tight text-brand-black sm:text-6xl">{resource.title}</h2>
        {resource.campusNames.length > 0 && <p className="mt-4 text-sm text-mid-grey">For {resource.campusNames.join(', ')}</p>}
      </header>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]">
        <div className="space-y-8">
          {embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-2xl bg-brand-black shadow-xl shadow-brand-black/10">
              <iframe
                src={embedUrl}
                title={`${resource.title} video`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : resource.promotionalImageUrl ? (
            <div className="aspect-video overflow-hidden rounded-2xl bg-brand-black">
              {/* Protected, same-origin image route. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resource.promotionalImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}

          {resource.description && (
            <div className="rounded-2xl border border-warm-grey bg-white p-7 text-base leading-8 text-dark-grey sm:p-10">
              {resource.description}
            </div>
          )}

          {resource.promotionalImageUrl && embedUrl && (
            <div className="overflow-hidden rounded-2xl bg-brand-black">
              {/* Protected, same-origin image route. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resource.promotionalImageUrl} alt="" className="h-auto w-full" />
            </div>
          )}
        </div>

        <aside className="h-fit rounded-2xl bg-[#f2efeb] p-6 sm:p-8">
          {resource.bibleReference && (
            <div className="border-b border-warm-grey pb-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mid-grey">Bible reference</p>
              <p className="mt-2 text-xl font-bold text-brand-black">{resource.bibleReference}</p>
            </div>
          )}

          {resource.hosts.length > 0 && (
            <div className="border-b border-warm-grey py-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mid-grey">With</p>
              <div className="mt-4 space-y-3">
                {resource.hosts.map((host, index) => (
                  <div key={`${host.name}-${index}`} className="flex items-center gap-3">
                    <MemberAvatar name={host.name} src={host.avatarUrl} size="small" />
                    <span className="font-bold text-brand-black">{host.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-6">
            {resource.hasLeaderNotes && (
              <a href={`/members/connect-group-leader-resources/${resource.rockId}/files/leader-notes`} className="flex min-h-14 items-center gap-3 rounded-xl bg-white px-4 font-bold text-rich-red shadow-sm transition-colors hover:bg-rich-red hover:text-white">
                <FileIcon /> Leader Notes
              </a>
            )}
            {resource.hasMemberStudy && (
              <a href={`/members/connect-group-leader-resources/${resource.rockId}/files/member-study`} className="flex min-h-14 items-center gap-3 rounded-xl bg-white px-4 font-bold text-rich-red shadow-sm transition-colors hover:bg-rich-red hover:text-white">
                <FileIcon /> Member Study
              </a>
            )}
          </div>
        </aside>
      </div>
    </MemberPortalChrome>
  )
}
