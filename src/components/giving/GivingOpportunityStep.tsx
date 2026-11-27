'use client'

import { useState, type FormEvent } from 'react'
import { FiArrowLeft, FiArrowRight, FiHeart } from 'react-icons/fi'
import presentation from '@/lib/giving/campaign-presentation.json'
import { GIVE_SUNDAY_GIFTS, GIVE_SUNDAY_SUGGESTED_AMOUNTS_MINOR } from '@/lib/giving/campaign'
import { CAMPAIGN_PROGRESS, formatCampaignProgress } from '@/lib/giving/campaign-progress'
import { MediaImage } from '@/components/media/MediaImage'
import { CampaignProgressDisplay } from './CampaignProgress'
import { giftAmountMinor } from './GiftAmountDialog'

export const GUIDED_OPPORTUNITIES = ['plant', 'train', 'grow', 'build'] as const
export type GivingOpportunityId = typeof GUIDED_OPPORTUNITIES[number] | 'greatest-need'

export function GivingOpportunityStep({ id, amount, locked, editing, compact = false, onContinue, onSkip, onBack, onGreatestNeed }: {
  id: GivingOpportunityId
  amount?: number
  locked: boolean
  editing: boolean
  compact?: boolean
  onContinue(amount: number): void
  onSkip(): void
  onBack(): void
  onGreatestNeed(): void
}) {
  const gift = GIVE_SUNDAY_GIFTS.find(item => item.id === id)!
  const opportunity = presentation.opportunities.find(item => item.giftId === id)
  const [value, setValue] = useState(amount ? String(amount / 100) : '')
  const [error, setError] = useState('')
  const general = id === 'greatest-need'
  function submit(event: FormEvent) {
    event.preventDefault()
    const chosen = giftAmountMinor(value)
    if (chosen === null) { setError(general ? 'Enter a whole-dollar amount from $1 to $999,999.' : 'Enter a whole-dollar amount from $1 to $999,999, or skip this opportunity.'); return }
    onContinue(chosen)
  }
  return <div className="mx-auto max-w-5xl">
    {!compact && <button type="button" onClick={onBack} disabled={locked} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-dark-grey disabled:opacity-40"><FiArrowLeft aria-hidden="true" />Back</button>}
    <div className={compact ? '' : 'overflow-hidden rounded-2xl border border-warm-grey bg-white md:grid md:grid-cols-2'}>
      <div className={compact ? 'relative aspect-[16/7] overflow-hidden' : 'relative aspect-[3/2] md:aspect-auto md:min-h-96'}>
        {opportunity ? <MediaImage media={opportunity.image} mediaSize="large" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          : <div className="flex h-full min-h-60 items-center justify-center bg-brand-black"><FiHeart aria-hidden="true" className="h-20 w-20 text-rich-red" strokeWidth={1} /></div>}
        {!general && <>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/85 via-black/35 to-transparent" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black,transparent)]" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-8 sm:px-6">
            <CampaignProgressDisplay title={gift.title} values={CAMPAIGN_PROGRESS[id]} overImage />
          </div>
        </>}
      </div>
      <div className={compact ? 'mx-auto max-w-2xl px-4 pt-5 sm:px-6' : 'p-6 sm:p-8'}>
        {(general || editing) && <p className="text-sm font-semibold text-rich-red">{general ? 'Give where it is needed most' : 'Edit your gift'}</p>}
        <h1 className={`${general || editing ? 'mt-3 ' : ''}text-2xl font-bold leading-heading text-brand-black`}>{gift.title}</h1>
        <p className="mt-4 leading-relaxed text-dark-grey">{opportunity?.description ?? gift.description}</p>
        <form onSubmit={submit} noValidate className="mt-7">
          <label htmlFor="opportunity-amount" className="block font-semibold">How much would you like to give?</label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {GIVE_SUNDAY_SUGGESTED_AMOUNTS_MINOR.map(suggestion => <button key={suggestion} type="button" disabled={locked}
              aria-pressed={value === String(suggestion / 100)} onClick={() => { setValue(String(suggestion / 100)); setError('') }}
              className={`rounded-xl border px-3 py-3 font-semibold disabled:opacity-40 ${value === String(suggestion / 100) ? 'border-rich-red bg-rich-red text-white' : 'border-warm-grey bg-white hover:border-rich-red'}`}>
              {formatCampaignProgress(suggestion, 'money')}
            </button>)}
          </div>
          <p className="mt-4 text-sm text-dark-grey">Enter your own amount</p>
          <div className="relative mt-2">
            <span aria-hidden="true" className="absolute left-4 top-3 text-mid-grey">$</span>
            <input id="opportunity-amount" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={value} disabled={locked}
              onKeyDown={event => { if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !/^\d$/u.test(event.key)) event.preventDefault() }}
              onChange={event => { if (/^\d*$/u.test(event.target.value)) { setValue(event.target.value); setError('') } }}
              aria-invalid={Boolean(error)} aria-describedby={error ? 'opportunity-amount-error' : undefined}
              className="w-full rounded-xl border border-warm-grey bg-white py-3 pl-8 pr-4" placeholder="0" />
          </div>
          {error && <p id="opportunity-amount-error" role="alert" className="mt-3 text-sm text-rich-red">{error}</p>}
          <button type="submit" disabled={locked} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-rich-red px-6 py-3.5 font-semibold text-white disabled:opacity-40">
            {general ? 'Continue to payment' : editing ? 'Save changes' : id === 'build' ? 'Review your gifts' : 'Continue'}<FiArrowRight aria-hidden="true" />
          </button>
          {!general && <button type="button" disabled={locked} onClick={onSkip} className="mt-4 w-full py-2 text-sm font-semibold text-dark-grey underline underline-offset-4 disabled:opacity-40">
            {editing ? 'Remove this gift' : 'Skip this opportunity'}
          </button>}
        </form>
      </div>
    </div>
    {!general && <div className={`mx-auto mt-6 max-w-2xl text-center ${compact ? 'px-4 sm:px-6' : ''}`}>
      <div className="flex items-center gap-3 text-sm text-mid-grey"><span className="h-px flex-1 bg-warm-grey" /><span>or</span><span className="h-px flex-1 bg-warm-grey" /></div>
      <button type="button" disabled={locked} onClick={onGreatestNeed} className="mt-6 font-semibold text-rich-red underline underline-offset-4 disabled:opacity-40">Give to greatest need</button>
    </div>}
  </div>
}
