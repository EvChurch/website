'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { campaignCartCatalog } from '@/lib/giving/cart-preview'
import { campaignGiftsSchema, type CampaignCheckoutGift } from '@/lib/giving/campaign-checkout'
import { FiArrowRight, FiEdit2, FiGift } from 'react-icons/fi'
import { CAMBODIA_SPONSORSHIP_URL } from '@/lib/giving/campaign'
import { GivingOpportunityStep, GUIDED_OPPORTUNITIES, type GivingOpportunityId } from './GivingOpportunityStep'
import { useGivingExperience } from './GivingExperienceProvider'
import { Button } from '@/components/ui/Button'
import { GIVE_SUNDAY_RETURN_MESSAGE } from '@/lib/giving/campaign-access'
import { campaignProgressFromReceipts, type CampaignProgressKey, type CampaignReceipts } from '@/lib/giving/campaign-progress'

const money = (minor: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)

interface CartControls {
  catalog: ReturnType<typeof campaignCartCatalog>
  quantities: Record<string, number>
  locked: boolean
  completed: boolean
  startGiving(): void
}
const CartContext = createContext<CartControls | null>(null)

export function usePendingGiftAmount(key?: CampaignProgressKey): number {
  const cart = useContext(CartContext)
  if (!cart || cart.completed || !key || key === 'cambodia') return 0
  const receipts: CampaignReceipts = { plant: 0, train: 0, grow: 0, build: 0, 'greatest-need': 0 }
  for (const item of cart.catalog) {
    if (Object.hasOwn(receipts, item.id)) receipts[item.id as keyof CampaignReceipts] = (item.fixedAmountMinor ?? 0) * (cart.quantities[item.id] ?? 0)
  }
  return campaignProgressFromReceipts(receipts)[key].given ?? 0
}

export function CampaignStartButton() {
  const giving = useGivingExperience()
  return <div className="mt-10 text-center">
    <Button type="button" size="large" disabled={!giving.campaignGivingAccessAllowed} onClick={giving.openCampaignGiving} className="disabled:cursor-not-allowed disabled:opacity-40">
      <FiGift aria-hidden="true" />Choose Your Gifts<FiArrowRight aria-hidden="true" />
    </Button>
    {!giving.campaignGivingAccessAllowed && <p className="mt-3 text-sm text-mid-grey">{GIVE_SUNDAY_RETURN_MESSAGE}</p>}
  </div>
}

export interface CampaignPaymentProps { gifts: CampaignCheckoutGift[]; onBack(): void; onVerified(): void }
export function GiveSundayCart({ children, afterCart, embedded = false, renderPayment }: { children?: ReactNode; afterCart?: ReactNode; embedded?: boolean; renderPayment?: (props: CampaignPaymentProps) => ReactNode }) {
  const giving = useGivingExperience()
  const [ready, setReady] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [view, setView] = useState<'overview' | 'review' | 'payment' | 'complete' | GivingOpportunityId>(embedded ? 'plant' : 'overview')
  const [editing, setEditing] = useState(false)
  const [generalBack, setGeneralBack] = useState<GivingOpportunityId | 'review'>('plant')
  const [generalDefaultAmount, setGeneralDefaultAmount] = useState<number | undefined>()
  const flowSection = useRef<HTMLElement>(null)
  const [fading, setFading] = useState(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState('')
  const locked = !ready || fading
  useEffect(() => () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }, [])
  useEffect(() => {
    setReady(true)
    try {
      const stored = sessionStorage.getItem('ev-give-sunday-selection')
      if (stored) {
        const gifts = campaignGiftsSchema.parse(JSON.parse(stored))
        setAmounts(Object.fromEntries(gifts.map(gift => [gift.opportunityId,gift.amountMinor])))
        setQuantities(Object.fromEntries(gifts.map(gift => [gift.opportunityId,1])))
        if (['pending','submitted'].includes(sessionStorage.getItem('ev-give-sunday-payment') ?? '')) setView('payment')
      }
    } catch { sessionStorage.removeItem('ev-give-sunday-selection'); sessionStorage.removeItem('ev-give-sunday-payment') }
  }, [])
  useEffect(() => {
    if (!ready) return
    const selected = Object.entries(amounts).filter(([id]) => quantities[id] > 0).map(([opportunityId,amountMinor]) => ({opportunityId,amountMinor}))
    if (selected.length) sessionStorage.setItem('ev-give-sunday-selection',JSON.stringify(selected))
    else sessionStorage.removeItem('ev-give-sunday-selection')
  }, [amounts,quantities,ready])
  useEffect(() => {
    if (view !== 'overview') {
      if (embedded && flowSection.current) flowSection.current.scrollTop = 0
      else flowSection.current?.scrollIntoView({ block: 'start' })
      flowSection.current?.focus({ preventScroll: true })
    }
  }, [embedded, view])
  useEffect(() => {
    if (!embedded || view === 'payment') return
    return giving.registerGivingBackHandler(() => {
      if (locked) return true
      if (view === 'review') { setEditing(false); setView('build'); return true }
      if (view === 'complete' || view === 'plant' && !editing) return false
      if (editing) { setEditing(false); setView('review'); return true }
      if (view === 'greatest-need') { setView(generalBack); return true }
      if (view === 'train' || view === 'grow' || view === 'build') {
        setView(GUIDED_OPPORTUNITIES[GUIDED_OPPORTUNITIES.indexOf(view) - 1]); return true
      }
      return false
    })
  }, [embedded, giving.registerGivingBackHandler, locked, view, editing, generalBack])
  function editCart() {
    sessionStorage.removeItem('ev-give-sunday-payment')
    sessionStorage.removeItem('ev-give-sunday-submission-key')
    setError('')
  }
  function startOver() {
    editCart()
    setAmounts({})
    setQuantities({})
    setEditing(false)
    setGeneralDefaultAmount(undefined)
    setGeneralBack('plant')
    setView('plant')
  }
  const catalog = campaignCartCatalog(false).map(item => ({ ...item, fixedAmountMinor: amounts[item.id] ?? item.fixedAmountMinor }))
  const lines = catalog.filter(item => (quantities[item.id] ?? 0) > 0)
  const total = lines.reduce((sum, item) => sum + (item.fixedAmountMinor ?? 0) * quantities[item.id], 0)
  function removeGift(id: string) {
    setQuantities(current => ({ ...current, [id]: 0 }))
    setAmounts(current => { const next = { ...current }; delete next[id]; return next })
    editCart()
  }
  function advance(id: GivingOpportunityId) {
    const index = GUIDED_OPPORTUNITIES.indexOf(id as typeof GUIDED_OPPORTUNITIES[number])
    const next = editing || id === 'greatest-need' || index === GUIDED_OPPORTUNITIES.length - 1 ? 'review' : GUIDED_OPPORTUNITIES[index + 1]
    if (editing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setView(next); setEditing(false); return
    }
    if (fadeTimer.current) return
    setFading(true)
    fadeTimer.current = setTimeout(() => {
      setView(next)
      setFading(false)
      fadeTimer.current = null
    }, 150)
  }
  function openGreatestNeed() {
    setGeneralBack(view === 'review' ? 'review' : view as GivingOpportunityId)
    setGeneralDefaultAmount(total > 0 ? total : undefined)
    setEditing(false)
    setView('greatest-need')
  }
  function checkout(draft?: { amounts: Record<string, number>; quantities: Record<string, number> }) {
    const selectedAmounts = draft?.amounts ?? amounts
    const selectedQuantities = draft?.quantities ?? quantities
    const selected = Object.entries(selectedAmounts).filter(([id]) => selectedQuantities[id] > 0).map(([opportunityId,amountMinor]) => ({opportunityId,amountMinor}))
    if (!campaignGiftsSchema.safeParse(selected).success) { setError('Choose at least one gift.'); return }
    if (!renderPayment) { setError('Giving is temporarily unavailable. Please try again later.'); return }
    sessionStorage.setItem('ev-give-sunday-selection',JSON.stringify(selected))
    sessionStorage.setItem('ev-give-sunday-payment','pending')
    setView('payment')
  }
  const paymentGifts = lines.map(item => ({ opportunityId: item.id, amountMinor: amounts[item.id] })) as CampaignCheckoutGift[]

  return <CartContext.Provider value={{ catalog, quantities, locked, completed: view === 'complete', startGiving: () => {
    if (view === 'complete') { setAmounts({}); setQuantities({}); editCart() }
    setEditing(false); setView('plant')
  } }}>
    {view === 'overview' ? <>{children}{afterCart}</> : view === 'payment' ? renderPayment?.({ gifts: paymentGifts, onBack: () => { editCart(); if (paymentGifts[0]?.opportunityId === 'greatest-need') setGeneralDefaultAmount(paymentGifts[0].amountMinor); setView(paymentGifts[0]?.opportunityId === 'greatest-need' ? 'greatest-need' : 'review') }, onVerified: () => { sessionStorage.removeItem('ev-give-sunday-payment'); const url = new URL(window.location.href); if (url.searchParams.get('giving') === 'return') { url.searchParams.delete('giving'); window.history.replaceState(null,'',url.pathname+url.search+url.hash) }; setView('complete') } }) : <section ref={flowSection} tabIndex={-1} aria-label="Give Sunday giving"
      style={{ opacity: fading ? 0 : 1 }}
      className={`transition-opacity duration-150 motion-reduce:transition-none ${embedded ? `h-full overflow-y-auto overscroll-contain bg-warm-white text-brand-black outline-none ${view === 'review' || view === 'complete' ? 'px-4 py-4 sm:px-6 sm:py-5' : 'pb-5'}` : 'scroll-mt-24 bg-warm-white px-5 pb-12 pt-32 text-brand-black outline-none lg:px-8 lg:pb-16 lg:pt-36'}`} aria-busy={fading}>
      {view === 'review' ? <div className="mx-auto max-w-2xl">
        {!embedded && <button type="button" disabled={locked} onClick={() => { setEditing(false); setView('build') }} className="mb-7 py-2 text-sm font-semibold text-dark-grey disabled:opacity-40">← Back to opportunities</button>}
        <h1 className={embedded ? 'text-2xl font-bold' : 'text-h1 leading-display'}>Review your gifts</h1>
        {lines.length === 0 ? <div className="my-8 rounded-xl border border-warm-grey bg-white p-6">
          <p>You haven’t chosen a gift yet. You can go back to the opportunities or give one amount to God’s Money Greatest Need.</p>
        </div> : <ul aria-label="Selected gifts" className="my-3 divide-y divide-black/10">
          {lines.map(item => {
            const [name, subtitle] = item.title.split(' — ')
            return <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
            <div className="min-w-0">
              <p className="font-semibold">{name}</p>
              {subtitle && <p className="mt-1 text-sm text-dark-grey">{subtitle.replace(/\b[a-z]/g, letter => letter.toUpperCase())}</p>}
            </div>
            <span className="ml-auto shrink-0 tabular-nums">{money((item.fixedAmountMinor ?? 0) * quantities[item.id])}</span>
            <button type="button" disabled={locked} aria-label={`Edit ${item.title} gift`} title="Edit gift"
              onClick={() => { setEditing(true); setView(item.id as GivingOpportunityId) }}
              className="inline-flex shrink-0 items-center justify-center p-2 text-rich-red focus-visible:outline-2 disabled:opacity-40">
              <FiEdit2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </li>})}
        </ul>}
        <p className="flex justify-between border-t border-black/10 pt-5 text-xl font-bold"><span>Total</span><span>{money(total)}</span></p>
        <button type="button" onClick={() => void checkout()} disabled={!lines.length} className="mt-7 w-full rounded-md bg-rich-red px-6 py-4 font-semibold text-white disabled:opacity-40">Continue to payment</button>
        {error && <p role="alert" className="mt-4 text-rich-red">{error}</p>}

        <div className="mt-6 text-center">
          <div className="flex items-center gap-3 text-sm text-mid-grey"><span className="h-px flex-1 bg-warm-grey" /><span>or</span><span className="h-px flex-1 bg-warm-grey" /></div>
          <button type="button" disabled={locked} onClick={openGreatestNeed} className="mt-6 font-semibold text-rich-red underline underline-offset-4 disabled:opacity-40">Give to greatest need</button>
        </div>
      </div> : view === 'complete' ? <div className="mx-auto max-w-2xl text-center" role="status">
        <h1 className={embedded ? 'text-2xl font-bold' : 'text-h1 leading-display'}>Thank you for your generosity.</h1>
        <p className="mt-5 text-lg">Your gift total: {money(total)}.</p>
        <div className="mt-10 rounded-2xl border border-warm-grey bg-white p-7 sm:p-10">
          <h2 className="text-2xl font-bold">Could you also sponsor a child in Cambodia?</h2>
          <p className="mt-4 leading-relaxed text-dark-grey">Help give children a brighter future through sponsorship with Tearfund. Sponsorship is arranged directly with Tearfund.</p>
          <a href={CAMBODIA_SPONSORSHIP_URL} className="mt-7 inline-flex items-center justify-center gap-2 rounded-md bg-rich-red px-7 py-4 font-semibold text-white">Explore child sponsorship ↗</a>
        </div>
        <div className="mt-7 flex flex-col items-center gap-2">
          <button type="button" onClick={() => embedded ? giving.dismissGiving() : setView('overview')} className="py-2 text-sm font-semibold text-dark-grey underline underline-offset-4">Back to the opportunities</button>
          <button type="button" onClick={startOver} className="py-2 text-sm text-mid-grey underline underline-offset-4 hover:text-brand-black">Start over</button>
        </div>
      </div> : <><GivingOpportunityStep key={`${view}-${editing}`} id={view} amount={view === 'greatest-need' && !editing ? generalDefaultAmount : amounts[view]} locked={locked} editing={editing} compact={embedded}
        onContinue={amount => {
          if (view === 'greatest-need') {
            const draft = { amounts: { 'greatest-need': amount }, quantities: { 'greatest-need': 1 } }
            setAmounts(draft.amounts); setQuantities(draft.quantities); editCart()
            void checkout(draft)
            return
          }
          setAmounts(current => ({ ...current, [view]: amount }))
          setQuantities(current => ({ ...current, [view]: 1 }))
          editCart(); advance(view)
        }}
        onSkip={() => { removeGift(view); advance(view) }}
        onBack={() => {
          if (editing) { setEditing(false); setView('review'); return }
          if (view === 'greatest-need') { setView(generalBack); return }
          const index = GUIDED_OPPORTUNITIES.indexOf(view)
          setView(index <= 0 ? 'overview' : GUIDED_OPPORTUNITIES[index - 1])
        }}
        onGreatestNeed={openGreatestNeed} />
        {view === 'greatest-need' && <div className="mx-auto max-w-2xl px-4 sm:px-6">
          {error && <p role="alert" className="mt-4 text-rich-red">{error}</p>}

        </div>}
      </>}
    </section>}
  </CartContext.Provider>
}
