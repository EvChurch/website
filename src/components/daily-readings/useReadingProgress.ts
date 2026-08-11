'use client'

import { useEffect, useState } from 'react'

import {
  readProgress,
  type ReadingProgressMap,
} from '@/lib/daily-readings/progress'

export function useReadingProgress(): ReadingProgressMap {
  const [progress, setProgress] = useState<ReadingProgressMap>({})

  useEffect(() => {
    const refresh = () => setProgress(readProgress())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('daily-reading-progress', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('daily-reading-progress', refresh)
    }
  }, [])

  return progress
}
