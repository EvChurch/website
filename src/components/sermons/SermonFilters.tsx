'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface FilterOption {
  slug: string
  label: string
  count: number
}

interface SermonFiltersProps {
  filters: {
    series: FilterOption[]
    speakers: FilterOption[]
    topics: FilterOption[]
    scriptures: FilterOption[]
  }
  currentSeries?: string
  currentSpeaker?: string
  currentTopic?: string
  currentScripture?: string
  currentQuery?: string
}

function FilterChipGroup({
  label,
  paramKey,
  options,
  currentValue,
  onSelect,
  isPending,
}: {
  label: string
  paramKey: string
  options: FilterOption[]
  currentValue?: string
  onSelect: (key: string, value: string | null) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const displayOptions = expanded ? options : options.slice(0, 8)

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warm-white/50">
        {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {displayOptions.map((opt) => {
          const isActive = opt.slug === currentValue
          return (
            <button
              key={opt.slug}
              type="button"
              onClick={() =>
                onSelect(paramKey, isActive ? null : opt.slug)
              }
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-brand-red text-warm-white'
                  : 'bg-warm-white/8 text-warm-white/70 hover:bg-warm-white/15 hover:text-warm-white'
              } ${isPending ? 'opacity-60' : ''}`}
            >
              {opt.label}
              <span className="ml-1 opacity-50">{opt.count}</span>
            </button>
          )
        })}
        {options.length > 8 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-full px-3 py-1 text-xs font-medium text-warm-white/40 hover:text-warm-white/70 transition-colors"
          >
            {expanded ? 'Show less' : `+${options.length - 8} more`}
          </button>
        )}
      </div>
    </div>
  )
}

export function SermonFilters({
  filters,
  currentSeries,
  currentSpeaker,
  currentTopic,
  currentScripture,
  currentQuery,
}: SermonFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(currentQuery ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [isPending, startTransition] = useTransition()

  // Optimistic local filter state so chips highlight immediately
  const [localFilters, setLocalFilters] = useState({
    series: currentSeries,
    speaker: currentSpeaker,
    topic: currentTopic,
    scripture: currentScripture,
  })

  // Sync local state when server props update
  useEffect(() => {
    isClearingRef.current = false
    setLocalFilters({
      series: currentSeries,
      speaker: currentSpeaker,
      topic: currentTopic,
      scripture: currentScripture,
    })
  }, [currentSeries, currentSpeaker, currentTopic, currentScripture])

  const hasActiveFilters =
    localFilters.series || localFilters.speaker || localFilters.topic || localFilters.scripture

  // Auto-show filters if any are active
  useEffect(() => {
    if (hasActiveFilters) setShowFilters(true)
  }, [hasActiveFilters])

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      // Optimistically update local state
      setLocalFilters((prev) => ({ ...prev, [key]: value ?? undefined }))

      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')

      startTransition(() => {
        router.push(`/sermons?${params.toString()}`)
      })
    },
    [router, searchParams, startTransition],
  )

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateParam('q', value || null)
      }, 350)
    },
    [updateParam],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const isClearingRef = useRef(false)

  const clearAll = () => {
    isClearingRef.current = true
    setLocalFilters({ series: undefined, speaker: undefined, topic: undefined, scripture: undefined })
    setQuery('')
    startTransition(() => {
      router.push('/sermons')
    })
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-warm-white/30"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setShowFilters(true)}
          placeholder="Search sermons, speakers, series..."
          className={`w-full rounded-xl border border-warm-white/10 bg-warm-white/5 py-3 pl-12 text-sm text-warm-white placeholder:text-warm-white/30 focus:border-warm-white/20 focus:bg-warm-white/8 focus:outline-none transition-colors ${hasActiveFilters || currentQuery ? 'pr-20' : 'pr-4'}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isPending && !isClearingRef.current && (
            <svg className="h-4 w-4 animate-spin text-warm-white/30" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {(hasActiveFilters || currentQuery) && (
            <button
              type="button"
              onClick={clearAll}
              className="cursor-pointer rounded-md px-2 py-0.5 text-xs text-warm-white/40 hover:text-warm-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter toggle */}
      {!showFilters && (
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-warm-white/40 hover:text-warm-white/70 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" />
          </svg>
          Filter by series, speaker, topic, or scripture
        </button>
      )}

      {/* Expanded filters */}
      {showFilters && (
        <div className="space-y-4 rounded-xl border border-warm-white/8 bg-warm-white/3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-warm-white/50">Filters</span>
            <button
              type="button"
              onClick={() => {
                setShowFilters(false)
                if (hasActiveFilters) clearAll()
              }}
              className="text-xs text-warm-white/30 hover:text-warm-white/60 transition-colors"
            >
              {hasActiveFilters ? 'Clear and close' : 'Close'}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {filters.series.length > 0 && (
              <FilterChipGroup
                label="Series"
                paramKey="series"
                options={filters.series}
                currentValue={localFilters.series}
                onSelect={updateParam}
                isPending={isPending}
              />
            )}
            {filters.speakers.length > 0 && (
              <FilterChipGroup
                label="Speaker"
                paramKey="speaker"
                options={filters.speakers}
                currentValue={localFilters.speaker}
                onSelect={updateParam}
                isPending={isPending}
              />
            )}
            {filters.topics.length > 0 && (
              <FilterChipGroup
                label="Topic"
                paramKey="topic"
                options={filters.topics}
                currentValue={localFilters.topic}
                onSelect={updateParam}
                isPending={isPending}
              />
            )}
            {filters.scriptures.length > 0 && (
              <FilterChipGroup
                label="Scripture"
                paramKey="scripture"
                options={filters.scriptures}
                currentValue={localFilters.scripture}
                onSelect={updateParam}
                isPending={isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
