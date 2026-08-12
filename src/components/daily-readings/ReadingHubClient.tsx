'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { DailyReadingView } from '@/lib/daily-readings/data'
import {
  currentStreak,
  recentReadingWeeks,
  weeklyStreak,
} from '@/lib/daily-readings/progress'
import { useReadingProgress } from './useReadingProgress'

const WEEKDAYS = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
] as const

function CheckCircleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16 9" />
    </svg>
  )
}

function displayDate(value: string, weekday = false): string {
  return new Date(value).toLocaleDateString('en-NZ', {
    ...(weekday ? { weekday: 'long' as const } : {}),
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland',
  })
}

function weekLabel(index: number): string {
  if (index === 0) return 'This week'
  if (index === 1) return 'Last week'
  return `${index} weeks ago`
}

function weekdayKey(value: string): string {
  return new Date(value).toLocaleDateString('en-NZ', {
    weekday: 'short',
    timeZone: 'Pacific/Auckland',
  })
}

function orderedWeekReadings(week: { readings: DailyReadingView[] }) {
  return WEEKDAYS.flatMap(({ key, label }) => {
    const reading = week.readings.find((item) => weekdayKey(item.sourceDate) === key)
    return reading ? [{ key, label, reading }] : []
  })
}

export function ReadingHubClient({ readings }: { readings: DailyReadingView[] }) {
  const [activeWeekIndex, setActiveWeekIndex] = useState(0)
  const latest = readings[0]
  const progress = useReadingProgress()
  const streak = currentStreak(readings, progress)
  const weeks = weeklyStreak(readings, progress)
  const latestProgress = latest ? progress[String(latest.rockId)] : undefined
  const recentWeeks = recentReadingWeeks(readings)

  if (!latest) return null

  return (
    <>
      <section>
        <article className="grid overflow-hidden rounded-2xl border border-warm-grey bg-white shadow-[0_24px_80px_rgba(15,0,4,0.08)] lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
          <div className="flex flex-col justify-between bg-brand-black p-7 text-white sm:p-10 lg:p-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-hero-eyebrow">Daily Bible Reading</p>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98] tracking-[-0.045em] text-warm-white">
                Make space for God’s word today.
              </h1>
            </div>
            <div className="mt-9 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/15 bg-white/5 p-5">
                <p className="text-3xl font-bold text-white">{streak}</p>
                <p className="mt-1 text-sm text-white/55">Current streak</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/5 p-5">
                <p className="text-3xl font-bold text-white">{weeks}</p>
                <p className="mt-1 text-sm text-white/55">Weeks in a row</p>
              </div>
            </div>
          </div>
          <div className="flex items-center p-7 sm:p-10 lg:p-12">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">
                {displayDate(latest.sourceDate, true)}
              </p>
              <h2 className="mt-3 text-[clamp(2.5rem,4vw,3.75rem)] leading-[1.05] tracking-[-0.035em] text-brand-black">
                {latest.passageReference}
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mid-grey">
                Take a few quiet minutes to read today’s passage, reflect on what it means, and pray in response.
              </p>
              <div className="mt-7">
                <Link href={`/members/daily-readings/${latest.rockId}`} rel="nofollow" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-rich-red px-6 text-sm font-bold text-white transition-colors hover:bg-deep-red">
                  {latestProgress?.completed && <CheckCircleIcon />}
                  {latestProgress?.completed ? 'Read again' : latestProgress ? 'Resume reading' : 'Begin reading'}
                </Link>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section id="reading-history" className="mt-14 scroll-mt-24">
        {recentWeeks.length > 0 ? (
          (() => {
            const activeWeek = recentWeeks[activeWeekIndex] ?? recentWeeks[0]
            const weekReadings = orderedWeekReadings({
              readings: activeWeekIndex === 0
                ? [latest, ...activeWeek.readings]
                : activeWeek.readings,
            })
            return (
              <div>
                <div className="relative mx-auto max-w-3xl pb-3">
                  <div className="absolute inset-x-6 bottom-0 top-5 rounded-2xl border border-warm-grey/70 bg-[#eee5da]" aria-hidden="true" />
                  <div className="absolute inset-x-3 bottom-1.5 top-2.5 rounded-2xl border border-warm-grey/80 bg-warm-white" aria-hidden="true" />
                  <article className="relative overflow-hidden rounded-2xl border border-warm-grey bg-white shadow-[0_18px_45px_rgba(15,0,4,0.08)]">
                    <header className="flex items-center justify-between gap-5 bg-brand-black px-5 py-5 text-white sm:px-8">
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/50">Weekly readings</p>
                        <h3 className="mt-1 text-2xl text-white">{weekLabel(activeWeekIndex)}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveWeekIndex((index) => Math.max(0, index - 1))}
                          disabled={activeWeekIndex === 0}
                          className="flex h-11 w-11 items-center justify-center text-xl text-white transition-opacity hover:text-hero-eyebrow disabled:opacity-20"
                          aria-label="Show newer week"
                        >
                          ←
                        </button>
                        <span className="min-w-12 text-center text-xs font-bold text-white/50">
                          {activeWeekIndex + 1} / {recentWeeks.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveWeekIndex((index) => Math.min(recentWeeks.length - 1, index + 1))}
                          disabled={activeWeekIndex === recentWeeks.length - 1}
                          className="flex h-11 w-11 items-center justify-center text-xl text-white transition-opacity hover:text-hero-eyebrow disabled:opacity-20"
                          aria-label="Show older week"
                        >
                          →
                        </button>
                      </div>
                    </header>
                    <div className="px-5 py-2 sm:px-8">
                      {weekReadings.map(({ key, label, reading }) => {
                        const readingProgress = progress[String(reading.rockId)]
                        return (
                          <Link
                            key={key}
                            href={`/members/daily-readings/${reading.rockId}`}
                            rel="nofollow"
                            className="group flex min-h-16 items-center gap-4 border-b border-warm-grey/70 py-3 last:border-b-0"
                            aria-label={`${displayDate(reading.sourceDate, true)}: ${reading.passageReference}${readingProgress?.completed ? ', complete' : readingProgress ? ', in progress' : ''}`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${readingProgress?.completed ? 'bg-rich-red text-white' : readingProgress ? 'border-2 border-rich-red text-rich-red' : 'bg-[#f5efe7] text-mid-grey group-hover:bg-rich-red group-hover:text-white'}`}
                              aria-hidden="true"
                            >
                              {readingProgress?.completed ? <CheckCircleIcon /> : label}
                            </span>
                            <span className="min-w-0 flex-1 text-base font-bold leading-snug text-brand-black sm:text-lg">
                              {reading.passageReference}
                            </span>
                            <span className="text-lg text-mid-grey transition-transform group-hover:translate-x-1 group-hover:text-rich-red" aria-hidden="true">→</span>
                          </Link>
                        )
                      })}
                    </div>
                  </article>
                </div>
              </div>
            )
          })()
        ) : (
          <p className="text-mid-grey">
            No previous readings are available yet.
          </p>
        )}
      </section>
    </>
  )
}
