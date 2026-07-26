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

/** Bible sections with canonical book order */
type Testament = 'Old Testament' | 'New Testament'

interface BibleSection {
  testament: Testament
  label: string
  books: string[]
}

const BIBLE_SECTIONS: BibleSection[] = [
  // Old Testament
  { testament: 'Old Testament', label: 'Law', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
  { testament: 'Old Testament', label: 'History', books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'] },
  { testament: 'Old Testament', label: 'Poetry & Wisdom', books: ['Job', 'Psalms', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Song of Songs'] },
  { testament: 'Old Testament', label: 'Major Prophets', books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel'] },
  { testament: 'Old Testament', label: 'Minor Prophets', books: ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
  // New Testament
  { testament: 'New Testament', label: 'Gospels', books: ['Matthew', 'Mark', 'Luke', 'John'] },
  { testament: 'New Testament', label: 'Church History', books: ['Acts'] },
  { testament: 'New Testament', label: 'Paul\'s Letters', books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'] },
  { testament: 'New Testament', label: 'General Letters', books: ['Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'] },
  { testament: 'New Testament', label: 'Prophecy', books: ['Revelation'] },
]

const ALL_BOOKS = BIBLE_SECTIONS.flatMap((s) => s.books)

function getBibleBookIndex(name: string): number {
  const normalised = name.toLowerCase()
  const idx = ALL_BOOKS.findIndex((b) => normalised.startsWith(b.toLowerCase()))
  return idx === -1 ? ALL_BOOKS.length : idx
}

function getSection(name: string): string | null {
  const normalised = name.toLowerCase()
  for (const section of BIBLE_SECTIONS) {
    if (section.books.some((b) => normalised.startsWith(b.toLowerCase()))) {
      return section.label
    }
  }
  return null
}

interface ScriptureEntry {
  book: string
  slug: string | null
  sermonCount: number
}

interface ScriptureGroup {
  testament: Testament
  label: string
  items: ScriptureEntry[]
}

/** Build the full Bible structure, merging in sermon counts from data */
function buildScriptureGroups(items: BrowseItem[]): ScriptureGroup[] {
  return BIBLE_SECTIONS.map((section) => ({
    testament: section.testament,
    label: section.label,
    items: section.books
      // Deduplicate aliases (Psalm/Psalms, Song of Solomon/Song of Songs)
      .filter((book, i, arr) => {
        const prev = arr[i - 1]
        if (!prev) return true
        // Keep the variant that has sermons, or the first one
        const bookHas = items.some((item) => item.name.toLowerCase().startsWith(book.toLowerCase()))
        const prevHas = items.some((item) => item.name.toLowerCase().startsWith(prev.toLowerCase()))
        // If this is an alias of the previous (same first 4 chars), only keep one
        if (book.toLowerCase().slice(0, 4) === prev.toLowerCase().slice(0, 4)) {
          return bookHas && !prevHas
        }
        return true
      })
      .map((book) => {
        const match = items.find((item) => item.name.toLowerCase().startsWith(book.toLowerCase()))
        return {
          book,
          slug: match?.slug ?? null,
          sermonCount: match?.sermonCount ?? 0,
        }
      }),
  }))
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

  const scriptureGroups = buildScriptureGroups(scriptureItems)

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6">
        <h2 className="mb-3 font-sans text-xl font-semibold text-warm-white">Browse</h2>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                mode === tab.key
                  ? 'bg-rich-red text-warm-white'
                  : 'bg-warm-white/10 text-warm-white/60 hover:bg-warm-white/15 hover:text-warm-white/80'
              }`}
            >
              {tab.label}
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

      {/* Scripture list - Bible order, OT/NT with sub-sections */}
      {mode === 'scripture' && (
        <div className="space-y-10">
          {(['Old Testament', 'New Testament'] as const).map((testament) => {
            const sections = scriptureGroups.filter((g) => g.testament === testament)
            if (sections.length === 0) return null
            return (
              <div key={testament}>
                <h3 className="mb-4 font-sans text-lg font-semibold text-warm-white">
                  {testament}
                </h3>
                <div className="space-y-6">
                  {sections.map((group) => (
                    <div key={group.label}>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-warm-white/40">
                        {group.label}
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {group.items.map((entry) =>
                          entry.slug && entry.sermonCount > 0 ? (
                            <Link
                              key={entry.book}
                              href={`/sermons/scriptures/${entry.slug}`}
                              className="flex items-center justify-between rounded-lg border border-warm-white/10 px-4 py-3 transition-all hover:border-warm-white/20 hover:bg-warm-white/5"
                            >
                              <span className="text-sm font-medium text-warm-white">{entry.book}</span>
                              <span className="ml-2 text-xs text-warm-white/40">
                                {entry.sermonCount} {entry.sermonCount === 1 ? 'sermon' : 'sermons'}
                              </span>
                            </Link>
                          ) : (
                            <div
                              key={entry.book}
                              className="flex items-center justify-between rounded-lg border border-warm-white/5 px-4 py-3"
                            >
                              <span className="text-sm font-medium text-warm-white/25">{entry.book}</span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
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
