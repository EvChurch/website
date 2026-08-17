'use client'

import { HiArrowRight } from 'react-icons/hi2'

import { useGivingExperience } from './GivingExperienceProvider'

export function OpenGivingButton() {
  const { givingSurfaceAvailable, openGiving } = useGivingExperience()

  return (
    <button
      type="button"
      disabled={!givingSurfaceAvailable}
      onClick={() => openGiving()}
      className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-rich-red px-7 font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black disabled:cursor-not-allowed disabled:opacity-50"
    >
      Start giving
      <HiArrowRight className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
