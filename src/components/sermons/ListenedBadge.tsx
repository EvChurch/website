'use client'

import { useListeningStore } from '@/lib/listening-store'
import { useEffect, useState } from 'react'

export function ListenedBadge({ slug }: { slug: string }) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const completed = useListeningStore((s) => s.history[slug]?.completed ?? false)

  if (!hydrated || !completed) return null

  return (
    <>
      <span className="animate-fade-in text-warm-white/30" aria-hidden="true">&middot;</span>
      <span className="flex animate-fade-in items-center gap-1 text-green-500">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        Listened
      </span>
    </>
  )
}
