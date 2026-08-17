'use client'

import { useEffect } from 'react'
import { HiArrowLeft } from 'react-icons/hi2'

import { TURNSTILE_TEST_SITE_KEY } from '@/lib/rock-forms/config'
import type { PublicGivingFund } from '@/lib/giving/contracts'
import { GivingExperienceProvider, useGivingExperience } from './GivingExperienceProvider'
import { GivingFlow } from './GivingFlow'

const previewFunds: PublicGivingFund[] = [
  { id: 1, name: 'General', code: 'GENERAL', sortOrder: 0, isDefault: true },
  { id: 2, name: 'Building Fund', code: 'BUILDING', sortOrder: 1, isDefault: false },
  { id: 3, name: 'Missions', code: 'MISSIONS', sortOrder: 2, isDefault: false },
]

function PreviewFrame() {
  const giving = useGivingExperience()

  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get('payment')
    giving.setFlagState(payment === 'blinkpay' ? 'enabled' : 'disabled')
    giving.setGivingViewActive(true)
    return () => giving.setGivingViewActive(false)
  }, [giving.setFlagState, giving.setGivingViewActive])

  return (
    <section className="flex h-[min(44rem,calc(100dvh-2rem))] w-full max-w-[26rem] flex-col overflow-hidden rounded-[1.75rem] border border-white/50 bg-warm-white shadow-2xl">
      <header className="relative flex min-h-[4.5rem] shrink-0 items-center justify-center px-4 py-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => giving.handleGivingBack()}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-black shadow-sm transition hover:bg-warm-grey/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
        >
          <HiArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold text-brand-black">Giving</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
        <GivingFlow
          funds={previewFunds}
          turnstileSiteKey={TURNSTILE_TEST_SITE_KEY}
          gatewayOrigins={['https://sandbox.secure.blinkpay.co.nz']}
          sandboxPreview
        />
      </div>
    </section>
  )
}

export function GivingPreview() {
  return (
    <GivingExperienceProvider serverEligibility="protected-e2e" givingExperience={<span />}>
      <PreviewFrame />
    </GivingExperienceProvider>
  )
}
