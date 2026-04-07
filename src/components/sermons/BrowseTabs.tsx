'use client'

import { useEffect, useState } from 'react'
import { SeriesCard } from './SeriesCard'
import Link from 'next/link'

type BrowseMode = 'series' | 'scripture' | 'preachers'

interface SeriesItem {
  id: number
  title: string
  slug: string
  bannerImage: { url: string; blurDataURL?: string | null } | null
  sermonCount: number
  earliestDate: string
  latestDate: string
}

interface BrowseItem {
  name: string
  slug: string
  sermonCount: number
}

interface BrowseTabsProps {
  seriesItems: SeriesItem[]
  scriptureItems: BrowseItem[]
  speakerItems: BrowseItem[]
}

const tabs: { key: BrowseMode; label: string }[] = [
  { key: 'series', label: 'Series' },
  { key: 'scripture', label: 'Scripture' },
  { key: 'preachers', label: 'Preachers' },
]

const hashToMode: Record<string, BrowseMode> = {
  '#series': 'series',
  '#scripture': 'scripture',
  '#preachers': 'preachers',
}

export function BrowseTabs({ seriesItems, scriptureItems, speakerItems }: BrowseTabsProps) {
  const [mode, setMode] = useState<BrowseMode>(() => {
    if (typeof window !== 'undefined') {
      return hashToMode[window.location.hash] ?? 'series'
    }
    return 'series'
  })

  useEffect(() => {
    const hash = window.location.hash
    const initial = hashToMode[hash]
    if (initial && initial !== mode) setMode(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* Header with tabs */}
      <div className="mb-5 flex items-baseline gap-1">
        <h2 className="font-sans text-xl font-semibold text-warm-white">Browse by</h2>
        <div className="flex">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className={`rounded-lg px-2.5 py-1 font-sans text-xl font-semibold transition-colors ${
                mode === tab.key
                  ? 'text-rich-red'
                  : 'text-warm-white/40 hover:text-warm-white/70'
              }`}
            >
              {tab.label}
              {i < tabs.length - 1 && (
                <span className="ml-1 text-warm-white/20 font-normal">/</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Series grid */}
      {mode === 'series' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seriesItems.map((s) => (
            <SeriesCard
              key={s.id}
              title={s.title}
              slug={s.slug}
              bannerImage={s.bannerImage}
              sermonCount={s.sermonCount}
              earliestDate={s.earliestDate}
              latestDate={s.latestDate}
            />
          ))}
        </div>
      )}

      {/* Scripture list */}
      {mode === 'scripture' && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {scriptureItems.map((s) => (
            <Link
              key={s.slug}
              href={`/sermons/scriptures/${s.slug}`}
              className="flex items-center justify-between rounded-lg border border-warm-white/10 px-4 py-3 transition-all hover:border-warm-white/20 hover:bg-warm-white/5"
            >
              <span className="text-sm font-medium text-warm-white">{s.name}</span>
              <span className="ml-2 text-xs text-warm-white/40">
                {s.sermonCount} {s.sermonCount === 1 ? 'sermon' : 'sermons'}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Preachers list */}
      {mode === 'preachers' && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {speakerItems.map((s) => (
            <Link
              key={s.slug}
              href={`/sermons/speakers/${s.slug}`}
              className="flex items-center justify-between rounded-lg border border-warm-white/10 px-4 py-3 transition-all hover:border-warm-white/20 hover:bg-warm-white/5"
            >
              <span className="text-sm font-medium text-warm-white">{s.name}</span>
              <span className="ml-2 text-xs text-warm-white/40">
                {s.sermonCount} {s.sermonCount === 1 ? 'sermon' : 'sermons'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
