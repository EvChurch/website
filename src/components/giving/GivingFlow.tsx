'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'

import { TurnstileWidget } from '@/components/forms/TurnstileWidget'
import { GIVING_REQUEST_MARKERS, isGivingCapabilityToken, parseGivingCheckoutStatus, type GivingCheckoutStatus, type PublicGivingFund } from '@/lib/giving/contracts'
import { trackGivingEvent, type GivingAnalyticsStep, type GivingFeedbackReason } from '@/lib/giving/analytics'
import { GIVING_BANK_ACCOUNT, type GivingBankTransferPreparation } from '@/lib/giving/bank-transfer'
import { assertRedirectUri } from '@/lib/giving/blinkpay/validation'
import { draftAnswers, createGivingState, givingReducer, type GivingAnswers, type GivingFrequency, type GivingIdentityField, type GivingStep } from './giving-state'
import { AmountStep } from './steps/AmountStep'
import { FrequencyStep } from './steps/FrequencyStep'
import { FundStep } from './steps/FundStep'
import { IdentityStep } from './steps/IdentityStep'
import { givingStartDateSummary, StartingDateStep } from './steps/StartingDateStep'
import { GivingAnswerTrail } from './GivingAnswerTrail'
import { BankTransferHandoff } from './BankTransferHandoff'
import { GivingCompletion, GivingPreparation } from './GivingCompletion'
import { useGivingExperience } from './GivingExperienceProvider'

export interface GivingFlowIdentity { signedIn: boolean; firstName?: string; lastName?: string; email?: string }
type CheckoutView = { type: 'configuring' } | { type: 'submitting' } | { type: 'status'; status: GivingCheckoutStatus; delayed: boolean }

const titles: Record<GivingStep, string> = {
  amount: 'How much would you like to give?', fund: 'What fund should this be for?', frequency: 'How often?', 'starting-date': 'Starting when?', 'identity-firstName': 'What is your first name?', 'identity-lastName': 'What is your last name?', 'identity-email': 'What is your email?', review: 'Continue with BlinkPay',
}
const progressSteps: readonly GivingStep[] = [
  'amount',
  'frequency',
  'fund',
  'starting-date',
  'identity-firstName',
  'identity-lastName',
  'identity-email',
  'review',
]

export function givingProgress(step: GivingStep, frequency: GivingFrequency | null) {
  const steps = frequency === 'one-off'
    ? progressSteps.filter((candidate) => candidate !== 'starting-date')
    : progressSteps
  return Math.round(((steps.indexOf(step) + 1) / steps.length) * 100)
}

export function givingHandoffSummary(answers: GivingAnswers) {
  const amount = `$${((answers.amountMinor ?? 0) / 100).toFixed(2)}`
  const fund = answers.fund?.name ?? 'your selected fund'
  if (answers.frequency === 'one-off') return `You’re giving ${amount} to ${fund} just this once.`
  const frequency = answers.frequency === 'weekly' ? 'every week'
    : answers.frequency === 'fortnightly' ? 'every two weeks'
      : answers.frequency === 'monthly' ? 'every month'
        : answers.frequency === 'annual' ? 'every year'
          : 'every day'
  const starting = answers.startDate ? `, starting ${givingStartDateSummary(answers.startDate)}` : ''
  return `You’re giving ${amount} to ${fund} ${frequency}${starting}.`
}

type GivingScrollIntent = 'forward' | 'edit' | 'surface'

export function positionGivingSurface(scroller: HTMLElement, panel: HTMLElement, progress: HTMLElement | null, intent: GivingScrollIntent) {
  if (intent === 'forward') {
    scroller.scrollTop = scroller.scrollHeight
    return
  }
  const scrollerRect = scroller.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const top = scrollerRect.top + 8
  const bottom = scrollerRect.bottom - (progress?.getBoundingClientRect().height ?? 0) - 8
  if (intent === 'edit' || panelRect.height > bottom - top || panelRect.top < top) {
    scroller.scrollTop += panelRect.top - top
    return
  }
  if (panelRect.bottom > bottom) scroller.scrollTop += panelRect.bottom - bottom
}

function analyticsStep(step:GivingStep):GivingAnalyticsStep{return step.startsWith('identity-')?'identity':step as GivingAnalyticsStep}
export function safeGivingGatewayRedirect(value: unknown, allowedOrigins: readonly string[]): string | null {
  if (typeof value !== 'string') return null
  try { return assertRedirectUri(value,allowedOrigins) } catch { return null }
}

const definitiveFailedGivingStates: readonly GivingCheckoutStatus['state'][] = ['cancelled', 'rejected', 'expired']

export function givingCheckoutPresentation(status: GivingCheckoutStatus, delayed = false) {
  let message: string
  switch(status.state){
    case'verified':message=status.kind==='recurring'?'Your recurring gift is confirmed and its schedule is active.':'Your gift is confirmed.';break
    case'processing':message=delayed?'This is taking a little longer. You may safely close this flow while Ev keeps checking; there is no need to try again.':'We’re confirming your gift with BlinkPay.';break
    case'unknown':message='We’re still checking the outcome. Do not try again; Ev will reconcile it safely.';break
    case'cancelled':case'expired':case'rejected':message='No gift was made.';break
  }
  return {message,showRetry:status.retryAllowed && definitiveFailedGivingStates.includes(status.state)}
}

const givingFeedbackOptions: readonly { value: GivingFeedbackReason; label: string }[] = [
  { value: 'change-something', label: 'I went back to change something' },
  { value: 'decided-not-to-give', label: 'I decided not to give' },
  { value: 'testing', label: 'I was testing' },
  { value: 'technical-problem', label: 'Something didn\u2019t work' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
]

function GivingOutcomeFeedback() {
  const [reason, setReason] = useState<GivingFeedbackReason | null>(null)
  const [sent, setSent] = useState(false)

  const submit = () => {
    if (!reason || sent) return
    trackGivingEvent('giving_outcome_feedback', { step: 'result', outcome: 'failed', feedback_reason: reason })
    setSent(true)
  }

  if (sent) return <p role="status" className="mt-6 border-t border-warm-grey pt-5 text-sm font-semibold">Thanks for letting us know.</p>

  return <form className="mt-6 border-t border-warm-grey pt-5" onSubmit={(event) => { event.preventDefault();submit() }}>
    <fieldset>
      <legend className="font-semibold">Would you tell us what happened? <span className="font-normal text-dark-grey">(Optional)</span></legend>
      <div className="mt-3 space-y-3">
        {givingFeedbackOptions.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-3 text-sm text-dark-grey"><input type="radio" name="giving-feedback-reason" value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} className="mt-0.5 size-4 accent-rich-red" /> <span>{option.label}</span></label>)}
      </div>
    </fieldset>
    <button type="submit" disabled={!reason} className="mt-5 min-h-11 rounded-full bg-rich-red px-5 font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 disabled:opacity-50">Send feedback</button>
  </form>
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

export function GivingFlow({ funds, identity = { signedIn: false }, resumeRequested = false, turnstileSiteKey, gatewayOrigins }: { funds: PublicGivingFund[]; identity?: GivingFlowIdentity; resumeRequested?: boolean; turnstileSiteKey: string; gatewayOrigins: readonly string[] }) {
  const known = useMemo(() => ({ firstName: identity.firstName ?? '', lastName: identity.lastName ?? '', email: identity.email ?? '' }), [identity.email, identity.firstName, identity.lastName])
  const [state, dispatch] = useReducer(givingReducer, undefined, () => createGivingState(funds, known))
  const [error, setError] = useState<string>()
  const [restoring, setRestoring] = useState(false)
  const [customDateOpen, setCustomDateOpen] = useState(false)
  const [checkout, setCheckout] = useState<CheckoutView>({ type: 'configuring' })
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)
  const [identityLoading, setIdentityLoading] = useState(false)
  const [bankTransfer, setBankTransfer] = useState<GivingBankTransferPreparation | null>(null)
  const [bankPreparationRetryRequired, setBankPreparationRetryRequired] = useState(false)
  const [bankAcknowledging, setBankAcknowledging] = useState(false)
  const [bankAcknowledged, setBankAcknowledged] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'blinkpay' | 'bank-transfer' | null>(null)
  const giving = useGivingExperience()
  const flowRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const scrollIntent = useRef<GivingScrollIntent | null>(null)
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

  useEffect(() => {
    setBankTransfer(null)
    setBankAcknowledged(false)
    setBankPreparationRetryRequired(false)
  }, [answerFingerprint, paymentMode])
  useEffect(() => {
    if (!giving.givingViewActive) {
      setPaymentMode(null)
      return
    }
    if (state.step === 'review' && paymentMode === null && giving.flagState !== 'unresolved') {
      setPaymentMode(giving.blinkPayEnabled ? 'blinkpay' : 'bank-transfer')
    }
  }, [giving.blinkPayEnabled, giving.flagState, giving.givingViewActive, paymentMode, state.step])
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
  useEffect(() => {
    if (checkout.type !== 'configuring' || state.step === 'review') headingRef.current?.focus()
  }, [state.step, checkout.type])
  useEffect(() => {
    if (state.step !== 'starting-date') setCustomDateOpen(false)
  }, [state.step])
  useLayoutEffect(() => {
    const intent = scrollIntent.current
    if (!intent || !flowRef.current) return
    scrollIntent.current = null
    let scroller = flowRef.current.parentElement
    while (scroller) {
      const overflowY = getComputedStyle(scroller).overflowY
      if ((overflowY === 'auto' || overflowY === 'scroll') && scroller.scrollHeight > scroller.clientHeight) break
      scroller = scroller.parentElement
    }
    if (!scroller) return
    const panel = flowRef.current.querySelector<HTMLElement>('[data-giving-step]')
    if (!panel) return
    positionGivingSurface(scroller, panel, flowRef.current.querySelector<HTMLElement>('[data-giving-progress]'), intent)
  }, [checkout.type, customDateOpen, state.step])
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    if (!giving.givingViewActive) return
    if (!trackedStart.current) {
      trackedStart.current=true
      trackGivingEvent('giving_flow_started',{outcome:'started'})
    }
    const step=analyticsStep(state.step)
    if(checkout.type==='configuring'&&trackedStep.current!==step){trackedStep.current=step;trackGivingEvent('giving_step_viewed',{step,outcome:'continued'})}
    const returning=new URLSearchParams(window.location.search).get('giving')==='return'
    if(returning&&!trackedReturn.current){trackedReturn.current=true;trackGivingEvent('giving_provider_returned',{step:'result',outcome:'returned'})}
    if(checkout.type==='status'&&checkout.status.state==='verified'&&!trackedVerified.current){trackedVerified.current=true;trackGivingEvent('giving_outcome_verified',{step:'result',outcome:'verified'})}
  },[checkout,giving.givingViewActive,state.step])
  useEffect(() => giving.registerGivingBackHandler(() => {
    if (checkout.type === 'submitting') return true
    if (checkout.type !== 'configuring' || stateRef.current.step === 'amount') return false
    scrollIntent.current = 'edit'
    setError(undefined)
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

  const next = () => { scrollIntent.current = 'forward'; setError(undefined); dispatch({ type: 'next' }) }
  const persistDraft = async (signal?: AbortSignal) => {
    const operation = currentOperation()
    const answers = draftAnswers(state.answers)
    if (!answers) throw new Error('invalid draft')
    const response = await fetch('/api/giving/drafts', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answers), signal: signal ?? operation.signal })
    if (!operationIsCurrent(operation)) throw new DOMException('Giving flow closed', 'AbortError')
    if (!response.ok) throw new Error('draft unavailable')
  }
  const submit = async () => {
    if (!turnstileToken || state.step !== 'review' || verifiedFingerprint.current !== answerFingerprint || !state.answers.amountMinor || !state.answers.fund || !state.answers.frequency) return
    const operation = currentOperation()
    const submitAbort = new AbortController()
    const abortSubmit = () => submitAbort.abort()
    operation.signal.addEventListener('abort', abortSubmit, { once: true })
    const submitTimer = setTimeout(abortSubmit, GIVING_SUBMIT_TIMEOUT_MS)
    let rotateSubmissionKey = false
    leavingFlow.current = true
    setCheckout({ type: 'submitting' });setError(undefined)
    try {
      await persistDraft(submitAbort.signal)
      const response = await fetch('/api/giving/checkouts', { method:'POST',headers:{'content-type':'application/json','x-ev-giving-request':'checkout-v1'},body:JSON.stringify({submissionKey:flowSubmissionKey.current,amountMinor:state.answers.amountMinor,fundId:state.answers.fund.id,frequency:state.answers.frequency,firstPaymentDate:state.answers.frequency==='one-off'?null:state.answers.startDate,firstName:state.answers.firstName,lastName:state.answers.lastName,email:state.answers.email,turnstileToken}),signal:submitAbort.signal })
      const value = await response.json() as { outcome?: unknown; retryAllowed?: unknown; gatewayRedirectUri?: unknown }
      rotateSubmissionKey = response.status >= 500 && value.retryAllowed === true
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
      if (operationIsCurrent(operation)) { if (rotateSubmissionKey) flowSubmissionKey.current=submissionKey();verifiedFingerprint.current=null;setCheckout({ type: 'configuring' });setTurnstileToken('');setTurnstileReset((value)=>value+1);setError('We could not start secure bank authorisation. Your gift details are saved; please try again.') }
    } finally {
      clearTimeout(submitTimer)
      operation.signal.removeEventListener('abort', abortSubmit)
    }
  }
  const prepareBankTransfer = useCallback(async () => {
    if (state.step !== 'review' || !state.answers.amountMinor || !state.answers.fund || !state.answers.frequency) return
    if (!turnstileToken || verifiedFingerprint.current !== answerFingerprint) return
    const operation = currentOperation()
    const submitAbort = new AbortController()
    const abortSubmit = () => submitAbort.abort()
    operation.signal.addEventListener('abort', abortSubmit, { once: true })
    const submitTimer = setTimeout(abortSubmit, GIVING_SUBMIT_TIMEOUT_MS)
    setCheckout({ type: 'submitting' })
    setError(undefined)
    try {
      const response = await fetch('/api/giving/bank-transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ev-giving-request': GIVING_REQUEST_MARKERS.bankTransfer },
        body: JSON.stringify({
          submissionKey: flowSubmissionKey.current,
          amountMinor: state.answers.amountMinor,
          fundId: state.answers.fund.id,
          frequency: state.answers.frequency,
          firstPaymentDate: state.answers.frequency === 'one-off' ? null : state.answers.startDate,
          firstName: state.answers.firstName,
          lastName: state.answers.lastName,
          email: state.answers.email,
          turnstileToken,
        }),
        signal: submitAbort.signal,
      })
      const value = await response.json() as Partial<GivingBankTransferPreparation>
      if (!operationIsCurrent(operation)) return
      if (!response.ok ||
          value.accountName !== GIVING_BANK_ACCOUNT.accountName ||
          value.accountNumber !== GIVING_BANK_ACCOUNT.accountNumber ||
          typeof value.particulars !== 'string' || value.particulars.length < 1 || value.particulars.length > 12 ||
          typeof value.code !== 'string' || !/^[A-Z0-9]{1,12}$/u.test(value.code) ||
          typeof value.reference !== 'string' || !/^EV[1-9][0-9]*$/u.test(value.reference) ||
          !isGivingCapabilityToken(value.acknowledgementToken)) {
        throw new Error('bank transfer unavailable')
      }
      setBankTransfer(value as GivingBankTransferPreparation)
      setBankPreparationRetryRequired(false)
      setCheckout({ type: 'configuring' })
    } catch {
      if (operationIsCurrent(operation)) {
        verifiedFingerprint.current = null
        setCheckout({ type: 'configuring' })
        setTurnstileToken('')
        setBankPreparationRetryRequired(true)
        setError('We could not prepare your bank transfer details. Please try again.')
      }
    } finally {
      clearTimeout(submitTimer)
      operation.signal.removeEventListener('abort', abortSubmit)
    }
  }, [answerFingerprint, currentOperation, operationIsCurrent, state.answers, turnstileToken])
  useEffect(() => {
    if (paymentMode !== 'bank-transfer' || state.step !== 'review' || checkout.type !== 'configuring' || bankTransfer || bankPreparationRetryRequired || !turnstileToken) return
    void prepareBankTransfer()
  }, [bankPreparationRetryRequired, bankTransfer, checkout.type, paymentMode, prepareBankTransfer, state.step, turnstileToken])
  const retryBankTransferPreparation = () => {
    verifiedFingerprint.current = null
    setError(undefined)
    setTurnstileToken('')
    setBankPreparationRetryRequired(false)
    setTurnstileReset((value) => value + 1)
  }
  const acknowledgeBankSetup = async () => {
    if (bankAcknowledging || bankAcknowledged) return
    if (!bankTransfer) return
    const operation = currentOperation()
    setBankAcknowledging(true)
    setError(undefined)
    try {
      const response = await fetch('/api/giving/bank-transfer/acknowledge', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ev-giving-request': GIVING_REQUEST_MARKERS.bankTransferAcknowledgement },
        body: JSON.stringify({ token: bankTransfer.acknowledgementToken }),
        signal: operation.signal,
      })
      const value = await response.json() as { acknowledged?: unknown; verified?: unknown }
      if (!operationIsCurrent(operation)) return
      if (!response.ok || value.acknowledged !== true || value.verified !== false) throw new Error('acknowledgement unavailable')
      setBankAcknowledged(true)
    } catch (error) {
      if (operationIsCurrent(operation) && !(error instanceof DOMException && error.name === 'AbortError')) {
        setError('We could not record that just now. Your bank details are unchanged; please try again.')
      }
    } finally {
      if (operationIsCurrent(operation)) setBankAcknowledging(false)
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
  const editAnswer = (step: GivingStep) => {
    editingName.current = step === 'identity-firstName'
    scrollIntent.current = 'edit'
    setError(undefined)
    dispatch({ type: 'edit', step, returnTo: state.step })
  }

  let content
  if (restoring) content = <p role="status">Restoring your gift…</p>
  else if (checkout.type === 'submitting') content = <GivingPreparation mode={paymentMode === 'blinkpay' ? 'blinkpay' : 'bank-transfer'} />
  else if (checkout.type === 'status') {
    const { status, delayed } = checkout
    const presentation = givingCheckoutPresentation(status,delayed)
    const showFeedback = definitiveFailedGivingStates.includes(status.state)
    content = status.state === 'verified'
      ? <GivingCompletion firstName={status.firstName} kind={status.kind} onDone={() => giving.dismissGiving()} />
      : <div className="rounded-2xl bg-white p-5 shadow-sm"><p role="status" className="font-semibold">{presentation.message}</p>{presentation.showRetry && <button type="button" className="mt-5 font-semibold text-rich-red" onClick={() => void returnToGift()}>Return to your saved gift</button>}{showFeedback && <GivingOutcomeFeedback />}</div>
  } else switch (state.step) {
    case 'amount': content = <AmountStep value={state.answers.amountMinor} error={error} showFrequencyPreview={state.answers.frequency === null} onContinue={(amountMinor) => { if (!amountMinor || amountMinor < 100) { setError('Enter an amount of at least $1.00.'); return };scrollIntent.current = 'forward';setError(undefined);dispatch({ type: 'commitAmount', amountMinor }) }} />; break
    case 'fund': content = <FundStep funds={funds} selected={state.answers.fund?.id ?? null} onSelect={(fund) => { scrollIntent.current = 'forward';dispatch({ type: 'setFund', fund });dispatch({ type: 'next' }) }} />; break
    case 'frequency': content = <FrequencyStep selected={state.answers.frequency} onSelect={(frequency) => { dispatch({ type: 'setFrequency', frequency }); queueMicrotask(next) }} />; break
    case 'starting-date': content = <StartingDateStep value={state.answers.startDate} frequency={state.answers.frequency!} amountMinor={state.answers.amountMinor!} onCustomOpenChange={(open) => { scrollIntent.current = 'surface';setCustomDateOpen(open) }} onInvalid={() => setError('Choose a valid starting date.')} onSelect={(startDate) => { setCustomDateOpen(false); setError(undefined); dispatch({ type: 'setStartDate', startDate }); queueMicrotask(next) }} />; break
    case 'identity-firstName': case 'identity-lastName': case 'identity-email': {
      const field = state.step.replace('identity-', '') as GivingIdentityField
      const continueIdentity = editingName.current && field === 'firstName' ? () => { scrollIntent.current = 'forward';dispatch({ type: 'edit', step: 'identity-lastName' }) } : editingName.current && field === 'lastName' ? () => { editingName.current = false;next() } : next
      content = identity.signedIn && identityLoading
        ? <p role="status">Loading your saved details…</p>
        : <IdentityStep field={field} value={state.answers[field]} onChange={(value) => {editedIdentity.current.add(field);dispatch({ type: 'setIdentity', field, value })}} onContinue={continueIdentity} />;break
    }
    case 'review': {
      if (paymentMode === null) {
        content = <p role="status" className="text-sm text-dark-grey">Preparing your payment options…</p>
      } else if (paymentMode === 'blinkpay') {
        content = <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-warm-grey/60"><p className="text-lg leading-relaxed text-dark-grey">You’ll now be taken to BlinkPay to complete your payment setup with your bank. BlinkPay is a trusted third party that uses open banking technology.</p><div className="mt-6"><TurnstileWidget siteKey={turnstileSiteKey} action="giving-checkout" resetKey={turnstileReset} onToken={handleTurnstileToken} onError={setError} /><p className="mt-4 rounded-2xl bg-warm-grey/35 px-5 py-4 font-semibold text-brand-black">{givingHandoffSummary(state.answers)}</p><button type="button" disabled={!turnstileToken} onClick={() => void submit()} className="mt-4 min-h-14 w-full rounded-full bg-rich-red px-5 font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 disabled:opacity-50">Continue to BlinkPay</button></div></div>
      } else {
        content = bankTransfer
          ? bankAcknowledged
            ? <GivingCompletion firstName={state.answers.firstName} kind="bank-transfer" onDone={() => giving.dismissGiving()} />
            : <BankTransferHandoff details={bankTransfer} summary={givingHandoffSummary(state.answers)} acknowledged={false} acknowledging={bankAcknowledging} onAcknowledge={() => void acknowledgeBankSetup()} />
          : <div className="py-3"><TurnstileWidget siteKey={turnstileSiteKey} action="giving-checkout" resetKey={turnstileReset} onToken={handleTurnstileToken} onError={setError} />{bankPreparationRetryRequired ? <button type="button" className="mt-4 min-h-12 w-full rounded-full bg-rich-red px-5 font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2" onClick={retryBankTransferPreparation}>Try again</button> : <p role="status" className="text-sm text-dark-grey">Preparing your bank details…</p>}</div>
      }
      break
    }
  }
  const heading = checkout.type === 'status' ? (checkout.status.state === 'verified' ? 'Giving complete' : definitiveFailedGivingStates.includes(checkout.status.state) ? 'Gift not completed' : 'Your giving result') : checkout.type === 'submitting' ? (paymentMode === 'blinkpay' ? 'Opening BlinkPay' : 'Preparing your bank details') : customDateOpen && state.step === 'starting-date' ? 'OK, choose a start date' : state.step === 'review' ? (paymentMode === 'blinkpay' ? 'Continue with BlinkPay' : paymentMode === 'bank-transfer' ? (bankAcknowledged ? 'Giving complete' : 'Bank transfer details') : 'Payment details') : titles[state.step]
  const progress = checkout.type === 'configuring' ? givingProgress(state.step, state.answers.frequency) : 100
  const transitionKey = checkout.type === 'configuring' ? state.step : checkout.type
  const highlightedQuestion = checkout.type === 'configuring' && state.step !== 'amount' && state.step !== 'review'
  return <section aria-labelledby="giving-step-heading" className="mx-auto flex min-h-full max-w-lg flex-col py-2 [overflow-anchor:none]" data-giving-private ref={flowRef}>{checkout.type === 'configuring' && <GivingAnswerTrail answers={state.answers} currentStep={state.step} visitedSteps={state.history} placement="before" onEdit={editAnswer} />}<div key={transitionKey} data-giving-step data-question-panel={highlightedQuestion ? 'highlighted' : undefined} className={`animate-fade-in-up motion-reduce:animate-none ${highlightedQuestion ? 'rounded-[2rem] bg-warm-grey/35 p-5 shadow-sm ring-1 ring-warm-grey/50' : ''}`}><h3 ref={headingRef} tabIndex={-1} id="giving-step-heading" className="mb-6 text-2xl font-semibold text-brand-black outline-none">{heading}</h3><div>{content}{error && state.step !== 'amount' && checkout.type === 'configuring' && <p role="alert" className="mt-4 text-sm text-rich-red">{error}</p>}</div></div>{checkout.type === 'configuring' && <GivingAnswerTrail answers={state.answers} currentStep={state.step} visitedSteps={state.history} placement="after" onEdit={editAnswer} />}<div className="sticky bottom-0 z-10 mt-auto bg-warm-white/95 pb-1 pt-6 backdrop-blur-sm" data-giving-progress><div role="progressbar" aria-label="Giving progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-5 overflow-hidden rounded-full bg-warm-grey/55"><div className="h-full rounded-full bg-rich-red transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div></div></section>
}
