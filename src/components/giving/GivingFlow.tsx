'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { TurnstileWidget } from '@/components/forms/TurnstileWidget'
import { parseGivingCheckoutStatus, type GivingCheckoutStatus, type PublicGivingFund } from '@/lib/giving/contracts'
import { trackGivingEvent, type GivingAnalyticsStep } from '@/lib/giving/analytics'
import { assertRedirectUri } from '@/lib/giving/blinkpay/validation'
import { draftAnswers, createGivingState, givingReducer, type GivingIdentityField, type GivingStep } from './giving-state'
import { AmountStep } from './steps/AmountStep'
import { FrequencyStep } from './steps/FrequencyStep'
import { FundStep } from './steps/FundStep'
import { IdentityStep } from './steps/IdentityStep'
import { ReviewStep } from './steps/ReviewStep'
import { StartingDateStep } from './steps/StartingDateStep'
import { useGivingExperience } from './GivingExperienceProvider'

export interface GivingFlowIdentity { signedIn: boolean; firstName?: string; lastName?: string; email?: string }
type CheckoutView = { type: 'configuring' } | { type: 'submitting' } | { type: 'status'; status: GivingCheckoutStatus; delayed: boolean }

const titles: Record<GivingStep, string> = {
  amount: 'How much would you like to give?', fund: 'Where should your gift go?', frequency: 'How often would you like to give?', 'starting-date': 'When should it start?', 'identity-firstName': 'What is your first name?', 'identity-lastName': 'What is your last name?', 'identity-email': 'What is your email?', review: 'Review your gift',
}
function analyticsStep(step:GivingStep):GivingAnalyticsStep{return step.startsWith('identity-')?'identity':step as GivingAnalyticsStep}
export function safeGivingGatewayRedirect(value: unknown, allowedOrigins: readonly string[]): string | null {
  if (typeof value !== 'string') return null
  try { return assertRedirectUri(value,allowedOrigins) } catch { return null }
}

export function givingCheckoutPresentation(status: GivingCheckoutStatus, delayed = false) {
  let message: string
  switch(status.state){
    case'verified':message=status.kind==='recurring'?'Your recurring gift is confirmed and its schedule is active.':'Your gift is confirmed.';break
    case'processing':message=delayed?'This is taking a little longer. You may safely close this flow while EV keeps checking; there is no need to try again.':'We’re confirming your gift with BlinkPay.';break
    case'unknown':message='We’re still checking the outcome. Do not try again; EV will reconcile it safely.';break
    case'cancelled':message='Bank authorisation was cancelled. No gift was made.';break
    case'expired':message='Bank authorisation expired, so setup was not completed.';break
    case'rejected':message='The bank did not accept the setup, so no gift was made.';break
  }
  return {message,showRetry:status.retryAllowed && ['cancelled','rejected','expired'].includes(status.state)}
}

export function givingStatusPollDelay(attempt:number){
  if(attempt<4)return 2_000
  return Math.min(30_000,4_000*(2**(attempt-4)))
}
export const GIVING_STATUS_POLL_LIMIT=12
const GIVING_SUBMIT_TIMEOUT_MS=20_000

function submissionKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '')
}

export function GivingFlow({ funds, identity = { signedIn: false }, resumeRequested = false, turnstileSiteKey, synthetic = false, gatewayOrigins }: { funds: PublicGivingFund[]; identity?: GivingFlowIdentity; resumeRequested?: boolean; turnstileSiteKey: string; synthetic?: boolean; gatewayOrigins: readonly string[] }) {
  const known = useMemo(() => ({ firstName: identity.firstName ?? '', lastName: identity.lastName ?? '', email: identity.email ?? '' }), [identity.email, identity.firstName, identity.lastName])
  const [state, dispatch] = useReducer(givingReducer, undefined, () => createGivingState(funds, known))
  const [error, setError] = useState<string>()
  const [restoring, setRestoring] = useState(false)
  const [checkout, setCheckout] = useState<CheckoutView>({ type: 'configuring' })
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)
  const [identityLoading, setIdentityLoading] = useState(false)
  const giving = useGivingExperience()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const leavingFlow = useRef(false)
  const editingName = useRef(false)
  const flowSubmissionKey = useRef<string | undefined>(undefined)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollAttempt = useRef(0)
  const pollInFlight = useRef(false)
  const pollActive = useRef(true)
  const delayedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trackedStart = useRef(false)
  const trackedReturn = useRef(false)
  const trackedVerified = useRef(false)
  const trackedStep = useRef<GivingAnalyticsStep | null>(null)
  const asyncGeneration = useRef(0)
  const asyncAbort = useRef(new AbortController())
  const givingWasActive = useRef(false)
  const verifiedFingerprint = useRef<string | null>(null)
  const editedIdentity = useRef(new Set<GivingIdentityField>())
  const memberIdentity = useRef<Partial<Record<GivingIdentityField,string>>>(known)
  const identityResolved = useRef(!identity.signedIn || (['firstName','lastName','email'] as const).every((field) => Boolean(known[field])))

  const answerFingerprint = useMemo(() => JSON.stringify([
    state.answers.amountMinor,
    state.answers.fund?.id ?? null,
    state.answers.frequency,
    state.answers.startDate,
    state.answers.firstName,
    state.answers.lastName,
    state.answers.email,
  ]), [state.answers])
  const currentOperation = useCallback(() => ({ generation: asyncGeneration.current, signal: asyncAbort.current.signal }), [])
  const operationIsCurrent = useCallback((operation: { generation: number; signal: AbortSignal }) => operation.generation === asyncGeneration.current && !operation.signal.aborted, [])
  const cancelAsyncWork = useCallback(() => {
    asyncGeneration.current += 1
    asyncAbort.current.abort()
    asyncAbort.current = new AbortController()
    pollActive.current = false
    if (pollTimer.current) clearTimeout(pollTimer.current)
    if (delayedTimer.current) clearTimeout(delayedTimer.current)
    pollTimer.current = null
    delayedTimer.current = null
  }, [])

  if (!flowSubmissionKey.current) flowSubmissionKey.current = submissionKey()
  useEffect(() => { headingRef.current?.focus() }, [state.step, checkout.type])
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    if (!giving.givingViewActive) return
    if (!trackedStart.current) {
      trackedStart.current=true
      trackGivingEvent('giving_flow_started',{outcome:'started',synthetic})
    }
    const step=analyticsStep(state.step)
    if(checkout.type==='configuring'&&trackedStep.current!==step){trackedStep.current=step;trackGivingEvent('giving_step_viewed',{step,outcome:'continued',synthetic})}
    const returning=new URLSearchParams(window.location.search).get('giving')==='return'
    if(returning&&!trackedReturn.current){trackedReturn.current=true;trackGivingEvent('giving_provider_returned',{step:'result',outcome:'returned',synthetic})}
    if(checkout.type==='status'&&checkout.status.state==='verified'&&!trackedVerified.current){trackedVerified.current=true;trackGivingEvent('giving_outcome_verified',{step:'result',outcome:'verified',synthetic})}
  },[checkout,giving.givingViewActive,state.step,synthetic])
  useEffect(() => giving.registerGivingBackHandler(() => {
    if (checkout.type === 'submitting') return true
    if (checkout.type !== 'configuring' || stateRef.current.history.length === 0) return false
    dispatch({ type: 'back' })
    return true
  }), [checkout.type, giving.registerGivingBackHandler])
  useEffect(() => giving.registerGivingCloseHandler(() => checkout.type === 'submitting'), [checkout.type, giving.registerGivingCloseHandler])
  useEffect(() => {
    if (giving.givingViewActive) {
      givingWasActive.current = true
      pollActive.current = true
      return
    }
    if (givingWasActive.current) cancelAsyncWork()
  }, [cancelAsyncWork, giving.givingViewActive])
  useEffect(() => {
    if (!giving.givingViewActive || !identity.signedIn || identityResolved.current) return
    const operation = currentOperation()
    setIdentityLoading(true)
    void (async () => {
      try {
        const response = await fetch('/api/giving/identity', { cache:'no-store',signal:operation.signal })
        if (!operationIsCurrent(operation)) return
        const value = response.ok ? await response.json() as unknown : null
        if (!operationIsCurrent(operation)) return
        const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : null
        const hydrated: Partial<Record<GivingIdentityField,string>> = {}
        if (record?.signedIn === true) for (const field of ['firstName','lastName','email'] as const) {
          if (typeof record[field] === 'string' && record[field].length <= 320) hydrated[field] = record[field]
        }
        memberIdentity.current = hydrated
        dispatch({type:'hydrateIdentity',identity:hydrated,unedited:(['firstName','lastName','email'] as const).filter((field)=>!editedIdentity.current.has(field))})
        identityResolved.current = true
      } catch {
        if (operationIsCurrent(operation)) identityResolved.current = true
      } finally {
        if (operationIsCurrent(operation)) setIdentityLoading(false)
      }
    })()
  }, [currentOperation,giving.givingViewActive,identity.signedIn,operationIsCurrent])
  useEffect(() => {
    if (!turnstileToken) return
    if (state.step === 'review' && verifiedFingerprint.current === answerFingerprint) return
    verifiedFingerprint.current = null
    setTurnstileToken('')
    setTurnstileReset((value) => value + 1)
  }, [answerFingerprint, state.step, turnstileToken])
  const handleTurnstileToken = useCallback((token: string) => {
    verifiedFingerprint.current = token ? answerFingerprint : null
    setTurnstileToken(token)
  }, [answerFingerprint])

  const restoreDraft = useCallback(async () => {
    const operation = currentOperation()
    const response = await fetch('/api/giving/drafts', { cache: 'no-store', signal: operation.signal })
    if (!operationIsCurrent(operation)) return false
    if (!response.ok) return false
    const payload = await response.json() as { answers?: { amountMinor: number; fundId: number; frequency: typeof state.answers.frequency; startDate: string | null; firstName: string; lastName: string; email: string } }
    if (!operationIsCurrent(operation)) return false
    const saved = payload.answers
    const fund = funds.find((candidate) => candidate.id === saved?.fundId) ?? null
    if (!saved?.frequency) return false
    const restored = { ...saved, fund }
    for (const field of ['firstName','lastName','email'] as const) {
      if (!editedIdentity.current.has(field)) restored[field] = memberIdentity.current[field] || known[field] || saved[field]
    }
    dispatch({ type: 'restore', answers: restored, missingIdentity: (['firstName','lastName','email'] as const).filter((field)=>!restored[field]) })
    return true
  }, [currentOperation, funds, known, operationIsCurrent])

  const pollStatus = useCallback(async function poll(): Promise<void> {
    if(!pollActive.current||pollInFlight.current)return
    const operation = currentOperation()
    pollInFlight.current=true
    pollTimer.current=null
    try {
      const response = await fetch('/api/giving/checkouts/current/status', { cache: 'no-store', signal: operation.signal })
      if(!pollActive.current||!operationIsCurrent(operation))return
      if (!response.ok) { await restoreDraft(); if (operationIsCurrent(operation)) setCheckout({ type: 'configuring' }); return }
      const status = parseGivingCheckoutStatus(await response.json())
      if (!operationIsCurrent(operation)) return
      setCheckout((current) => ({ type: 'status', status, delayed: current.type === 'status' && current.delayed }))
      if (status.state === 'processing') {
        const attempt=pollAttempt.current
        pollAttempt.current=attempt+1
        if(pollAttempt.current>=GIVING_STATUS_POLL_LIMIT){
          setCheckout({type:'status',status:{...status,state:'unknown',retryAllowed:false},delayed:true})
        }else{
          pollTimer.current=setTimeout(() => void poll(),givingStatusPollDelay(attempt))
        }
      } else pollAttempt.current=0
    } catch {
      if (operationIsCurrent(operation)) setCheckout({ type: 'status', status: { state: 'unknown', retryAllowed: false, kind: 'one-off' }, delayed: true })
    } finally { pollInFlight.current=false }
  }, [currentOperation, operationIsCurrent, restoreDraft])

  useEffect(() => {
    if (!resumeRequested) return
    const returning = new URLSearchParams(window.location.search).get('giving') === 'return'
    const operation = currentOperation()
    setRestoring(true)
    void (async () => {
      try {
        await (returning ? pollStatus() : restoreDraft())
      } catch {
        if (operationIsCurrent(operation)) setError('We could not restore your saved gift. Please try again.')
      } finally {
        if (operationIsCurrent(operation)) setRestoring(false)
      }
    })()
    if (returning) delayedTimer.current = setTimeout(() => {
      if (operationIsCurrent(operation)) setCheckout((current) => current.type === 'status' ? { ...current, delayed: true } : current)
    }, 8_000)
  }, [currentOperation, operationIsCurrent, pollStatus, restoreDraft, resumeRequested])
  useEffect(() => {
    pollActive.current=true
    return () => {
      cancelAsyncWork()
      if (!leavingFlow.current) void fetch('/api/giving/drafts', { method: 'DELETE', keepalive: true })
    }
  }, [cancelAsyncWork])

  const next = () => { setError(undefined); dispatch({ type: 'next' }) }
  const persistDraft = async (method:'POST'|'PUT', signal?: AbortSignal) => {
    const operation = currentOperation()
    const answers = draftAnswers(state.answers, window.location.pathname)
    if (!answers) throw new Error('invalid draft')
    const response = await fetch('/api/giving/drafts', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(answers), signal: signal ?? operation.signal })
    if (!operationIsCurrent(operation)) throw new DOMException('Giving flow closed', 'AbortError')
    if (!response.ok) throw new Error('draft unavailable')
    if(method==='PUT')return null
    const { resumePath } = await response.json() as { resumePath?:unknown }
    if (!operationIsCurrent(operation)) throw new DOMException('Giving flow closed', 'AbortError')
    if(typeof resumePath!=='string'||!resumePath.startsWith('/give/resume/'))throw new Error('draft unavailable')
    return resumePath
  }
  const signIn = async () => {
    const operation = currentOperation()
    try {
      const resumePath=await persistDraft('POST')
      if(!resumePath||!operationIsCurrent(operation))return
      leavingFlow.current = true
      window.location.assign(`/auth/login?returnTo=${encodeURIComponent(resumePath)}`)
    } catch { if (operationIsCurrent(operation)) setError('We could not safely save your gift. Please try again.') }
  }
  const submit = async () => {
    if (!turnstileToken || state.step !== 'review' || verifiedFingerprint.current !== answerFingerprint || !state.answers.amountMinor || !state.answers.fund || !state.answers.frequency) return
    const operation = currentOperation()
    const submitAbort = new AbortController()
    const abortSubmit = () => submitAbort.abort()
    operation.signal.addEventListener('abort', abortSubmit, { once: true })
    const submitTimer = setTimeout(abortSubmit, GIVING_SUBMIT_TIMEOUT_MS)
    leavingFlow.current = true
    setCheckout({ type: 'submitting' });setError(undefined)
    try {
      await persistDraft('PUT', submitAbort.signal)
      const response = await fetch('/api/giving/checkouts', { method:'POST',headers:{'content-type':'application/json','x-ev-giving-request':'checkout-v1'},body:JSON.stringify({submissionKey:flowSubmissionKey.current,amountMinor:state.answers.amountMinor,fundId:state.answers.fund.id,frequency:state.answers.frequency,firstPaymentDate:state.answers.frequency==='one-off'?null:state.answers.startDate,firstName:state.answers.firstName,lastName:state.answers.lastName,email:state.answers.email,turnstileToken}),signal:submitAbort.signal })
      const value = await response.json() as { outcome?: unknown; retryAllowed?: unknown; gatewayRedirectUri?: unknown }
      if (!operationIsCurrent(operation)) return
      if (submitAbort.signal.aborted) throw new DOMException('Checkout timed out', 'TimeoutError')
      if(response.status===202&&value.outcome==='unknown'&&value.retryAllowed===false){
        setCheckout({type:'status',status:{state:'unknown',retryAllowed:false,kind:state.answers.frequency==='one-off'?'one-off':'recurring'},delayed:true})
        return
      }
      const redirect = response.ok ? safeGivingGatewayRedirect(value.gatewayRedirectUri,gatewayOrigins) : null
      if (!redirect) throw new Error('checkout unavailable')
      leavingFlow.current = true
      window.location.assign(redirect)
    } catch {
      if (operationIsCurrent(operation)) { verifiedFingerprint.current=null;setCheckout({ type: 'configuring' });setTurnstileToken('');setTurnstileReset((value)=>value+1);setError('We could not start secure bank authorisation. Your gift details are saved; please try again.') }
    } finally {
      clearTimeout(submitTimer)
      operation.signal.removeEventListener('abort', abortSubmit)
    }
  }
  const returnToGift = async () => {
    const operation = currentOperation()
    setRestoring(true)
    try {
      const restored = await restoreDraft()
      if (!operationIsCurrent(operation)) return
      setCheckout({type:'configuring'})
      if (!restored) setError('We could not restore your saved gift. Please try again.')
    } catch {
      if (operationIsCurrent(operation)) { setCheckout({type:'configuring'});setError('We could not restore your saved gift. Please try again.') }
    } finally {
      if (operationIsCurrent(operation)) setRestoring(false)
    }
  }

  let content
  if (restoring) content = <p role="status">Restoring your gift…</p>
  else if (checkout.type === 'submitting') content = <p role="status">Opening secure bank authorisation… Please wait.</p>
  else if (checkout.type === 'status') {
    const { status, delayed } = checkout
    const presentation = givingCheckoutPresentation(status,delayed)
    content = <div className="rounded-2xl bg-white p-5 shadow-sm"><p role="status" className="font-semibold">{presentation.message}</p>{presentation.showRetry && <button type="button" className="mt-5 font-semibold text-rich-red" onClick={() => void returnToGift()}>Return to your saved gift</button>}</div>
  } else switch (state.step) {
    case 'amount': content = <AmountStep value={state.answers.amountMinor} error={error} onContinue={(amountMinor) => { if (!amountMinor) { setError('Enter an amount greater than zero.'); return };setError(undefined);dispatch({ type: 'commitAmount', amountMinor }) }} />; break
    case 'fund': content = <FundStep funds={funds} selected={state.answers.fund?.id ?? null} onSelect={(fund) => { dispatch({ type: 'setFund', fund }); dispatch({ type: 'next' }) }} />; break
    case 'frequency': content = <FrequencyStep selected={state.answers.frequency} onSelect={(frequency) => { dispatch({ type: 'setFrequency', frequency }); queueMicrotask(next) }} />; break
    case 'starting-date': content = <StartingDateStep value={state.answers.startDate} frequency={state.answers.frequency!} amountMinor={state.answers.amountMinor!} onInvalid={() => setError('Choose a valid starting date.')} onSelect={(startDate) => { setError(undefined); dispatch({ type: 'setStartDate', startDate }); queueMicrotask(next) }} />; break
    case 'identity-firstName': case 'identity-lastName': case 'identity-email': {
      const field = state.step.replace('identity-', '') as GivingIdentityField
      const continueIdentity = editingName.current && field === 'firstName' ? () => dispatch({ type: 'edit', step: 'identity-lastName' }) : editingName.current && field === 'lastName' ? () => { editingName.current = false;dispatch({ type: 'next' }) } : next
      content = identity.signedIn && identityLoading
        ? <p role="status">Loading your saved details…</p>
        : <IdentityStep field={field} value={state.answers[field]} onChange={(value) => {editedIdentity.current.add(field);dispatch({ type: 'setIdentity', field, value })}} onContinue={continueIdentity} onSignIn={!identity.signedIn ? signIn : undefined} />;break
    }
    case 'review': content = <><ReviewStep answers={state.answers} onEdit={(step) => { editingName.current = step === 'identity-firstName';dispatch({ type: 'edit', step, returnTo: 'review' }) }} /><div className="mt-5"><TurnstileWidget siteKey={turnstileSiteKey} action="giving-checkout" resetKey={turnstileReset} onToken={handleTurnstileToken} onError={setError} /><button type="button" disabled={!turnstileToken} onClick={() => void submit()} className="mt-3 w-full rounded-full bg-rich-red px-5 py-3 font-semibold text-white disabled:opacity-50">Continue to secure bank authorisation</button></div></>;break
  }
  const heading = checkout.type === 'status' ? 'Your giving result' : checkout.type === 'submitting' ? 'Secure bank authorisation' : titles[state.step]
  return <section aria-labelledby="giving-step-heading" className="mx-auto max-w-lg py-2" data-giving-private>{synthetic && <p role="status" className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950">TEST DATA · BlinkPay sandbox · no real gift will be created.</p>}<p className="mb-2 text-sm font-semibold text-rich-red" aria-live="polite">Giving · {checkout.type === 'status' ? 'Result' : state.step === 'review' ? 'Review' : 'Step in progress'}</p><h3 ref={headingRef} tabIndex={-1} id="giving-step-heading" className="mb-6 text-2xl font-semibold text-brand-black outline-none">{heading}</h3>{content}{error && state.step !== 'amount' && checkout.type === 'configuring' && <p role="alert" className="mt-4 text-sm text-rich-red">{error}</p>}</section>
}
