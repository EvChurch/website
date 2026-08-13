import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MemberAvatar } from '@/components/members/MemberAvatar'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { getPublicLeaderResourceShare } from '@/lib/members/leader-resource-sharing'
import { youtubeVideoId } from '@/lib/members/youtube'

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

  return <div className="min-h-screen bg-warm-white px-5 py-10 sm:px-8 sm:py-16">
    <main className="mx-auto max-w-3xl">
      <a href="/" className="text-sm font-bold text-rich-red">EV Church</a>
      <article className="mt-6 overflow-hidden rounded-2xl bg-white shadow-xl shadow-brand-black/10">
        <header className="bg-rich-red px-6 py-8 text-white sm:px-10 sm:py-10">
          {resource.bibleReference && <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">{resource.bibleReference}</p>}
          <h1 className="mt-2 text-4xl leading-tight text-white sm:text-5xl">{resource.title}</h1>
          {resource.description && <p className="mt-5 text-base leading-relaxed text-white/85">{resource.description}</p>}
        </header>
        <div className="space-y-8 p-6 sm:p-10">
          {sharer && <section className="flex items-center gap-4 border-b border-warm-grey pb-6" aria-label="Shared by">
            <MemberAvatar name={sharer.name} src={sharer.avatarUrl} />
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-mid-grey">Shared with you by</p><p className="mt-1 text-lg font-bold text-brand-black">{sharer.name}</p></div>
          </section>}
          {videoId && <VideoPlayer videos={[{ campusName: 'Video', youtubeVideoId: videoId }]} />}
          {resource.hasLeaderNotes && <a href={`/shared/leader-resources/${token}/notes`} rel="nofollow noreferrer" className="inline-flex min-h-11 items-center rounded-md bg-rich-red px-5 py-3 text-sm font-bold text-white hover:bg-deep-red">Open notes</a>}
        </div>
      </article>
    </main>
  </div>
}
