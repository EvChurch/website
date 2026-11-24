'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

const campuses = [
  { id: 'central', label: 'Central' },
  { id: 'north', label: 'North' },
  { id: 'unichurch', label: 'Unichurch' },
] as const

export type ChristmasCampusId = typeof campuses[number]['id']

const CampusContext = createContext<{
  selectedId: ChristmasCampusId
  selectCampus: (id: ChristmasCampusId) => void
} | null>(null)

export function ChristmasCampusProvider({ children }: { children: ReactNode }) {
  const [selectedId, selectCampus] = useState<ChristmasCampusId>('central')
  return <CampusContext.Provider value={{ selectedId, selectCampus }}>{children}</CampusContext.Provider>
}

export function useChristmasCampus() {
  const context = useContext(CampusContext)
  if (!context) throw new Error('Christmas campus controls require ChristmasCampusProvider')
  return context
}

export function ChristmasCampusNavigation({ label }: { label: string }) {
  const { selectedId, selectCampus } = useChristmasCampus()
  return (
    <div role="group" aria-label={label} className="mx-auto flex w-fit max-w-full divide-x divide-[#d9b879] overflow-hidden rounded-full border border-[#d9b879]">
      {campuses.map((campus) => (
        <button
          key={campus.id}
          type="button"
          aria-pressed={selectedId === campus.id}
          onClick={() => selectCampus(campus.id)}
          className="inline-flex min-h-12 items-center justify-center px-4 py-3 text-base font-semibold text-[#f3d49b] transition-colors hover:bg-[#d9b879]/20 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#f3d49b] sm:px-6 aria-pressed:bg-[#d9b879] aria-pressed:text-[#0b203b]"
        >
          {campus.label}
        </button>
      ))}
    </div>
  )
}

export function ChristmasCampusPanel({ campus, children }: { campus: ChristmasCampusId; children: ReactNode }) {
  const { selectedId } = useChristmasCampus()
  return <div hidden={selectedId !== campus}>{children}</div>
}

export function ChristmasCentralButton() {
  const { selectCampus } = useChristmasCampus()
  return <button type="button" onClick={() => selectCampus('central')} className="font-semibold text-[#f3d49b] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3d49b]">Ev Central</button>
}
