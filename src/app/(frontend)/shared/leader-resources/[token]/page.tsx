import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MemberAvatar } from '@/components/members/MemberAvatar'
import { getPublicLeaderResourceShare } from '@/lib/members/leader-resource-sharing'
import { youtubeVideoId } from '@/lib/members/youtube'

function FileIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8m-6-6 6 6m-6-6v6h6M8 14h8m-8 4h5" />
  </svg>
}

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Shared leader resource',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  referrer: 'no-referrer',
}

export default async function SharedLeaderResourcePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await getPublicLeaderResourceShare(token)
  if (!share) notFound()
  const { resource, sharer } = share
  const videoId = youtubeVideoId(resource.youtubeUrl)

  return <div className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(226,42,48,0.32),transparent_34%),radial-gradient(circle_at_86%_78%,rgba(226,42,48,0.14),transparent_30%),linear-gradient(145deg,#0f0004,#21080d_55%,#0f0004)] pb-12 pt-24 sm:px-8 sm:pb-24 sm:pt-36">
    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-[0.06]"
      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }}
    />
    <main className="relative mx-auto max-w-3xl">
      {sharer && <section className="mx-4 mb-3 flex w-fit items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-lg shadow-brand-black/20 sm:mx-0" aria-label="Shared by">
        <MemberAvatar name={sharer.name} src={sharer.avatarUrl} size="xsmall" />
        <p className="text-xs text-brand-black"><span className="font-semibold">Shared by</span> <span className="font-bold">{sharer.name}</span></p>
      </section>}
      <article className="overflow-hidden bg-white sm:rounded-2xl sm:shadow-xl sm:shadow-brand-black/10">
        <header className="bg-rich-red px-6 py-8 text-white sm:px-10 sm:py-10">
          {resource.bibleReference && <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">{resource.bibleReference}</p>}
          <h1 className="mt-2 text-4xl leading-tight text-white sm:text-5xl">{resource.title}</h1>
          {resource.description && <p className="mt-5 text-base leading-relaxed text-white/85">{resource.description}</p>}
        </header>
        <div className="space-y-8 px-6 pb-6 sm:p-10">
          {videoId && <div className="-mx-6 aspect-video w-[calc(100%+3rem)] overflow-hidden bg-black sm:mx-0 sm:w-auto sm:rounded-xl">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
              title={resource.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>}
          {(resource.hasLeaderNotes || resource.hasMemberStudy) && <div className="flex flex-wrap gap-3">
            {resource.hasLeaderNotes && <a href={`/shared/leader-resources/${token}/notes`} target="_blank" rel="nofollow noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-rich-red px-5 py-3 text-sm font-bold text-white hover:bg-deep-red"><FileIcon /> Notes</a>}
            {resource.hasMemberStudy && <a href={`/shared/leader-resources/${token}/study`} target="_blank" rel="nofollow noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-brand-black px-5 py-3 text-sm font-bold text-brand-black hover:bg-brand-black hover:text-white"><FileIcon /> Study</a>}
          </div>}
        </div>
      </article>
    </main>
  </div>
}
