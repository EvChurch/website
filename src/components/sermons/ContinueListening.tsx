'use client'

import { useAudioPlayer, type ListeningRecord } from '@/components/audio/AudioPlayerProvider'
import { PlayButton } from '@/components/audio/PlayButton'
import Link from 'next/link'
import { useEffect, useState } from 'react'

function formatTimeLeft(progress: number, duration: number): string {
  const remaining = Math.max(0, duration - progress)
  const mins = Math.round(remaining / 60)
  return `${mins}m left`
}

export function ContinueListening() {
  const { getListeningHistory, markAsListened } = useAudioPlayer()
  const [records, setRecords] = useState<ListeningRecord[]>([])

  useEffect(() => {
    const history = getListeningHistory()
    setRecords(history.filter((r) => !r.completed && r.progress > 10).slice(0, 3))
  }, [getListeningHistory])

  if (records.length === 0) return null

  const handleMarkListened = (slug: string) => {
    markAsListened(slug)
    setRecords((prev) => prev.filter((r) => r.slug !== slug))
  }

  return (
    <section className="pb-8">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="mb-5 font-sans text-xl font-semibold text-warm-white">Continue Listening</h2>
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.slug} className="rounded-lg bg-warm-white/5 p-4">
              <div className="flex items-center gap-4">
                <PlayButton
                  sermon={{
                    id: r.slug,
                    title: r.title,
                    slug: r.slug,
                    audioUrl: r.audioUrl,
                    speaker: r.speaker,
                    series: r.series,
                    artworkUrl: r.artworkUrl,
                  }}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/sermons/${r.slug}`}
                    className="block truncate font-semibold text-warm-white hover:text-rich-red transition-colors"
                  >
                    {r.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-x-3 text-sm text-warm-white/50">
                    {r.speaker && <span>{r.speaker}</span>}
                    <span>{formatTimeLeft(r.progress, r.duration)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleMarkListened(r.slug)}
                  className="hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs text-warm-white/40 transition-colors hover:bg-warm-white/10 hover:text-warm-white/70 sm:flex"
                  aria-label={`Mark "${r.title}" as listened`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  Mark as listened
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
