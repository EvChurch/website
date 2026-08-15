'use client'

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import type { PublicGivingFund } from '@/lib/giving/contracts'
import { draftAnswers, createGivingState, givingReducer, type GivingIdentityField, type GivingStep } from './giving-state'
import { AmountStep } from './steps/AmountStep'
import { FrequencyStep } from './steps/FrequencyStep'
import { FundStep } from './steps/FundStep'
import { IdentityStep } from './steps/IdentityStep'
import { ReviewStep } from './steps/ReviewStep'
import { StartingDateStep } from './steps/StartingDateStep'
import { useGivingExperience } from './GivingExperienceProvider'

export interface GivingFlowIdentity { signedIn: boolean; firstName?: string; lastName?: string; email?: string }

const titles: Record<GivingStep, string> = {
  amount: 'How much would you like to give?', fund: 'Where should your gift go?', frequency: 'How often would you like to give?', 'starting-date': 'When should it start?', 'identity-firstName': 'What is your first name?', 'identity-lastName': 'What is your last name?', 'identity-email': 'What is your email?', review: 'Review your gift',
}

export function GivingFlow({ funds, identity = { signedIn: false }, resumeRequested = false }: { funds: PublicGivingFund[]; identity?: GivingFlowIdentity; resumeRequested?: boolean }) {
  const known = useMemo(() => ({ firstName: identity.firstName ?? '', lastName: identity.lastName ?? '', email: identity.email ?? '' }), [identity.email, identity.firstName, identity.lastName])
  const missingIdentity = useMemo<GivingIdentityField[]>(() => (['firstName', 'lastName', 'email'] as const).filter((field) => !known[field]), [known])
  const [state, dispatch] = useReducer(givingReducer, undefined, () => createGivingState(funds, known))
  const [error, setError] = useState<string>()
  const [restoring, setRestoring] = useState(false)
  const giving = useGivingExperience()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const leavingForSignIn = useRef(false)
  const editingName = useRef(false)

  useEffect(() => { headingRef.current?.focus() }, [state.step])
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => giving.registerGivingBackHandler(() => {
    if (stateRef.current.history.length === 0) return false
    dispatch({ type: 'back' })
    return true
  }), [giving.registerGivingBackHandler])
  useEffect(() => {
    if (!resumeRequested) return
    setRestoring(true)
    fetch('/api/giving/drafts', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return
      const payload = await response.json() as { answers?: { amountMinor: number; fundId: number; frequency: typeof state.answers.frequency; startDate: string | null; firstName: string; lastName: string; email: string } }
      const saved = payload.answers
      const fund = funds.find((candidate) => candidate.id === saved?.fundId) ?? null
      if (saved && saved.frequency) {
        const answers = {
          ...saved,
          fund,
          firstName: known.firstName || saved.firstName,
          lastName: known.lastName || saved.lastName,
          email: known.email || saved.email,
        }
        dispatch({ type: 'restore', answers, missingIdentity })
      }
    }).finally(() => setRestoring(false))
  }, [funds, known, missingIdentity, resumeRequested])
  useEffect(() => () => {
    if (!leavingForSignIn.current) void fetch('/api/giving/drafts', { method: 'DELETE', keepalive: true })
  }, [])

  const next = () => { setError(undefined); dispatch({ type: 'next', missingIdentity }) }
  const signIn = async () => {
    const answers = draftAnswers(state.answers, window.location.pathname)
    if (!answers) return
    const response = await fetch('/api/giving/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answers) })
    if (!response.ok) { setError('We could not safely save your gift. Please try again.'); return }
    const { resumePath } = await response.json() as { resumePath: string }
    leavingForSignIn.current = true
    window.location.assign(`/auth/login?returnTo=${encodeURIComponent(resumePath)}`)
  }

  let content
  if (restoring) content = <p role="status">Restoring your gift…</p>
  else switch (state.step) {
    case 'amount': content = <AmountStep value={state.answers.amountMinor} error={error} onContinue={(amountMinor) => {
      if (!amountMinor) { setError('Enter an amount greater than zero.'); return }
      setError(undefined)
      dispatch({ type: 'commitAmount', amountMinor })
    }} />; break
    case 'fund': content = <FundStep funds={funds} selected={state.answers.fund?.id ?? null} onSelect={(fund) => { dispatch({ type: 'setFund', fund }); dispatch({ type: 'next', missingIdentity }) }} />; break
    case 'frequency': content = <FrequencyStep selected={state.answers.frequency} onSelect={(frequency) => { dispatch({ type: 'setFrequency', frequency }); queueMicrotask(next) }} />; break
    case 'starting-date': content = <StartingDateStep value={state.answers.startDate} frequency={state.answers.frequency!} amountMinor={state.answers.amountMinor!} onInvalid={() => setError('Choose a valid starting date.')} onSelect={(startDate) => { setError(undefined); dispatch({ type: 'setStartDate', startDate }); queueMicrotask(next) }} />; break
    case 'identity-firstName':
    case 'identity-lastName':
    case 'identity-email': {
      const field = state.step.replace('identity-', '') as GivingIdentityField
      const continueIdentity = editingName.current && field === 'firstName'
        ? () => dispatch({ type: 'edit', step: 'identity-lastName' })
        : editingName.current && field === 'lastName'
          ? () => { editingName.current = false; dispatch({ type: 'next', missingIdentity }) }
          : next
      content = <IdentityStep field={field} value={state.answers[field]} onChange={(value) => dispatch({ type: 'setIdentity', field, value })} onContinue={continueIdentity} onSignIn={!identity.signedIn ? signIn : undefined} />
      break
    }
    case 'review': content = <ReviewStep answers={state.answers} onEdit={(step) => { editingName.current = step === 'identity-firstName'; dispatch({ type: 'edit', step, returnTo: 'review' }) }} />; break
  }
  return <section aria-labelledby="giving-step-heading" className="mx-auto max-w-lg py-2" data-giving-private><p className="mb-2 text-sm font-semibold text-rich-red" aria-live="polite">Giving · {state.step === 'review' ? 'Review' : 'Step in progress'}</p><h3 ref={headingRef} tabIndex={-1} id="giving-step-heading" className="mb-6 text-2xl font-semibold text-brand-black outline-none">{titles[state.step]}</h3>{content}{error && state.step !== 'amount' && <p role="alert" className="mt-4 text-sm text-rich-red">{error}</p>}</section>
}
