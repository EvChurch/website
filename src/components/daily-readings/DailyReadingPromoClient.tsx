'use client'

import Link from 'next/link'

import type { DailyReadingView } from '@/lib/daily-readings/data'
import { useReadingProgress } from './useReadingProgress'

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16 9" />
    </svg>
  )
}

export function DailyReadingPromoClient({ reading }: { reading: DailyReadingView }) {
  const progress = useReadingProgress()[String(reading.rockId)]
  const label = progress?.completed ? 'Read again' : progress ? 'Resume reading' : 'Start today’s reading'
  const detail = progress?.completed
    ? null
    : progress
      ? `${progress.stage[0].toUpperCase()}${progress.stage.slice(1)} · saved on this device`
      : 'About 8 minutes'

  return (
    <div className="mt-7">
      {detail && <p className="mb-3 text-sm text-mid-grey">{detail}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <Link
          href={`/members/daily-readings/${reading.rockId}`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-rich-red px-6 text-sm font-bold text-white transition-colors hover:bg-deep-red"
        >
          {progress?.completed && <CheckCircleIcon />} {label}
        </Link>
        <Link
          href="/members/daily-readings"
          className="inline-flex min-h-12 items-center justify-center gap-2 text-sm font-bold text-brand-black/65 transition-colors hover:text-rich-red sm:justify-start"
        >
          See more <ArrowIcon />
        </Link>
      </div>
    </div>
  )
}
