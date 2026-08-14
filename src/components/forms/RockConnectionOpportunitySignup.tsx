'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import {
  ROCK_CONNECTION_START_ACTION,
  ROCK_CONNECTION_SUBMIT_ACTION,
} from '@/lib/rock-connection-signups/constants'
import { connectionSchemaAvailability } from '@/lib/rock-connection-signups/field-types'
import type {
  RockConnectionSignupRequestBag,
  RockConnectionSignupSchema,
  RockPhoneValue,
} from '@/lib/rock-connection-signups/types'
import { RockAttributeField } from './RockAttributeField'
import { formInputClass, formLabelClass } from './form-styles'
import { SafeRockHtml } from './SafeRockHtml'
import { TurnstileWidget } from './TurnstileWidget'
import { trackSuccessfulFormSubmission } from '@/lib/analytics'

export { ROCK_CONNECTION_START_ACTION, ROCK_CONNECTION_SUBMIT_ACTION }

export type PublicConnectionSchema = Omit<RockConnectionSignupSchema, 'sessionGuid' | 'interactionGuid'>

export type ConnectionSignupValues = {
  firstName: string
  lastName: string
  email: string
  campusId: string
  homePhone: RockPhoneValue
  mobilePhone: RockPhoneValue
  comments: string
  attributeValues: Record<string, string>
}

export type ConnectionSignupState =
  | { phase: 'start'; error?: string }
  | { phase: 'editing'; error?: string }
  | { phase: 'submitting' }
  | { phase: 'success'; message: string }
  | { phase: 'outcomeUnknown' }

export type ConnectionSignupEvent =
  | { type: 'started' }
  | { type: 'submitting' }
  | { type: 'failed'; message: string }
  | { type: 'succeeded'; message: string }
  | { type: 'outcomeUnknown' }

export function connectionSignupReducer(
  state: ConnectionSignupState,
  event: ConnectionSignupEvent,
): ConnectionSignupState {
  switch (event.type) {
    case 'started':
      return { phase: 'editing' }
    case 'submitting':
      return state.phase === 'editing' ? { phase: 'submitting' } : state
    case 'failed':
      return { phase: state.phase === 'start' ? 'start' : 'editing', error: event.message }
    case 'succeeded':
      return { phase: 'success', message: event.message }
    case 'outcomeUnknown':
      return { phase: 'outcomeUnknown' }
  }
}

export function claimConnectionSubmission(lock: { current: boolean }): boolean {
  if (lock.current) return false
  lock.current = true
  return true
}

export function emptyConnectionSignupValues(schema: PublicConnectionSchema): ConnectionSignupValues {
  const selectedCampus = schema.selectedCampusId == null
    ? ''
    : String(schema.selectedCampusId)
  return {
    firstName: '',
    lastName: '',
    email: '',
    campusId: schema.campuses.length === 1
      ? schema.campuses[0].value
      : schema.campuses.some(({ value }) => value === selectedCampus)
        ? selectedCampus
        : '',
    homePhone: {},
    mobilePhone: {},
    comments: '',
    attributeValues: {},
  }
}

export function preserveConnectionSignupValues(
  schema: PublicConnectionSchema,
  current: ConnectionSignupValues | null,
): ConnectionSignupValues {
  const empty = emptyConnectionSignupValues(schema)
  if (!current) return empty
  const campusId = schema.campuses.some(({ value }) => value === current.campusId)
    ? current.campusId
    : empty.campusId
  const allowedAttributeKeys = new Set(schema.attributes.map(({ key }) => key))

  return {
    ...current,
    campusId,
    attributeValues: Object.fromEntries(
      Object.entries(current.attributeValues).filter(([key]) =>
        allowedAttributeKeys.has(key),
      ),
    ),
  }
}

export function buildConnectionSubmissionValues(
  schema: Pick<PublicConnectionSchema, 'campuses'>,
  values: ConnectionSignupValues,
): RockConnectionSignupRequestBag {
  const campus = schema.campuses.length === 1 ? schema.campuses[0].value : values.campusId
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    ...(campus ? { campusId: Number(campus) } : {}),
    ...(values.homePhone.number ? { homePhone: values.homePhone } : {}),
    ...(values.mobilePhone.number ? { mobilePhone: values.mobilePhone } : {}),
    ...(values.comments ? { comments: values.comments } : {}),
    ...(Object.keys(values.attributeValues).length > 0 ? { attributeValues: values.attributeValues } : {}),
  }
}

function PhoneField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: RockPhoneValue
  onChange: (value: RockPhoneValue) => void
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={formLabelClass}>{label}</label>
      <input
        id={id}
        className={formInputClass}
        type="tel"
        maxLength={40}
        autoComplete="tel"
        value={value.number || ''}
        onChange={(event) => onChange({ ...value, number: event.target.value, countryCode: value.countryCode || '+64' })}
      />
    </div>
  )
}

export function ConnectionSignupFields({
  schema,
  values,
  onChange,
}: {
  schema: PublicConnectionSchema
  values: ConnectionSignupValues
  onChange: (values: ConnectionSignupValues) => void
}) {
  const set = <Key extends keyof ConnectionSignupValues>(key: Key, value: ConnectionSignupValues[Key]) => {
    onChange({ ...values, [key]: value })
  }
  const orderedAttributes = useMemo(
    () => [...schema.attributes].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [schema.attributes],
  )

  return (
    <div className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={formLabelClass}>
          First name <span aria-hidden="true">*</span>
          <input className={formInputClass} maxLength={100} value={values.firstName} onChange={(event) => set('firstName', event.target.value)} required autoComplete="given-name" />
        </label>
        <label className={formLabelClass}>
          Last name <span aria-hidden="true">*</span>
          <input className={formInputClass} maxLength={100} value={values.lastName} onChange={(event) => set('lastName', event.target.value)} required autoComplete="family-name" />
        </label>
        <label className={`${formLabelClass} sm:col-span-2`}>
          Email <span aria-hidden="true">*</span>
          <input className={formInputClass} type="email" maxLength={254} value={values.email} onChange={(event) => set('email', event.target.value)} required autoComplete="email" />
        </label>
      </div>

      {schema.campuses.length > 1 && (
        <label className={formLabelClass}>
          Campus <span aria-hidden="true">*</span>
          <select className={formInputClass} value={values.campusId} onChange={(event) => set('campusId', event.target.value)} required>
            <option value="">Select…</option>
            {schema.campuses.map((campus) => <option key={campus.value} value={campus.value}>{campus.text}</option>)}
          </select>
        </label>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {schema.displayHomePhone && <PhoneField id="rock-connection-home-phone" label="Home phone" value={values.homePhone} onChange={(value) => set('homePhone', value)} />}
        {schema.displayMobilePhone && <PhoneField id="rock-connection-mobile-phone" label="Mobile phone" value={values.mobilePhone} onChange={(value) => set('mobilePhone', value)} />}
      </div>

      <label className={formLabelClass}>
        {schema.commentFieldLabel}
        <textarea className={formInputClass} rows={5} maxLength={4_000} value={values.comments} onChange={(event) => set('comments', event.target.value)} />
      </label>

      {orderedAttributes.map((attribute) => (
        <RockAttributeField
          key={attribute.attributeGuid}
          attribute={attribute}
          value={values.attributeValues[attribute.key] || ''}
          onChange={(value) => set('attributeValues', { ...values.attributeValues, [attribute.key]: value })}
        />
      ))}
    </div>
  )
}

export function ConnectionSignupTerminal({
  kind,
  message,
}: {
  kind: 'success' | 'outcomeUnknown'
  message?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.focus(), [])

  return (
    <div
      ref={ref}
      role="status"
      aria-live="assertive"
      tabIndex={-1}
      className={kind === 'success' ? 'rounded-lg bg-green-50 p-5 text-green-900 outline-none' : 'rounded-lg bg-amber-50 p-5 text-amber-950 outline-none'}
    >
      {kind === 'success' ? (
        <SafeRockHtml value={message || 'Thanks. Your request has been received.'} />
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold">We could not confirm the result</h3>
          <p>Your request may have succeeded. Please do not submit it again.</p>
          <a className="font-semibold text-rich-red underline" href="/contact">Contact us to confirm your request</a>
        </div>
      )}
    </div>
  )
}

type StartResponse = {
  turnstileSiteKey?: string
  schema?: PublicConnectionSchema
  contextToken?: string
  error?: string
}

type SubmitResponse = {
  status?: 'complete'
  resultType?: number
  message?: string | null
  error?: string
  outcomeUnknown?: boolean
  restartRequired?: boolean
}

export function RockConnectionOpportunitySignup({
  blockGuid,
  initialSchema = null,
  initialContextToken = '',
  initialSiteKey = '',
}: {
  blockGuid: string
  initialSchema?: PublicConnectionSchema | null
  initialContextToken?: string
  initialSiteKey?: string
}) {
  const endpoint = `/api/rock-connection-signups/${encodeURIComponent(blockGuid)}`
  const [state, dispatch] = useReducer(connectionSignupReducer, {
    phase: initialSchema && initialContextToken ? 'editing' : 'start',
  })
  const [loadingSiteKey, setLoadingSiteKey] = useState(
    !initialSchema && !initialSiteKey,
  )
  const [starting, setStarting] = useState(false)
  const [siteKey, setSiteKey] = useState(initialSiteKey)
  const [schema, setSchema] = useState<PublicConnectionSchema | null>(initialSchema)
  const [contextToken, setContextToken] = useState(initialContextToken)
  const [values, setValues] = useState<ConnectionSignupValues | null>(
    initialSchema ? emptyConnectionSignupValues(initialSchema) : null,
  )
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [configurationError, setConfigurationError] = useState('')
  const startingLock = useRef(false)
  const submitting = useRef(false)
  const startController = useRef<AbortController | null>(null)
  const submitController = useRef<AbortController | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (initialSchema && initialSiteKey) {
      setSiteKey(initialSiteKey)
      setSchema(initialSchema)
      setContextToken(initialContextToken)
      setValues(emptyConnectionSignupValues(initialSchema))
      setLoadingSiteKey(false)
      if (initialContextToken) dispatch({ type: 'started' })
      return
    }

    const controller = new AbortController()
    let active = true
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 45_000)
    setLoadingSiteKey(true)
    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as StartResponse
        if (!response.ok || !data.turnstileSiteKey) throw new Error(data.error || 'Unable to load this signup')
        setSiteKey(data.turnstileSiteKey)
      })
      .catch((error) => {
        if (active && timedOut) {
          dispatch({ type: 'failed', message: 'The signup took too long to load. Please try again.' })
        } else if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          dispatch({ type: 'failed', message: error instanceof Error ? error.message : 'Unable to load this signup' })
        }
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (active) setLoadingSiteKey(false)
      })
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [endpoint, initialSchema, initialContextToken, initialSiteKey])

  useEffect(
    () => () => {
      const activeStart = startController.current
      const activeSubmit = submitController.current
      startController.current = null
      submitController.current = null
      activeStart?.abort()
      activeSubmit?.abort()
      startingLock.current = false
      submitting.current = false
    },
    [endpoint],
  )

  useEffect(() => {
    if ('error' in state && state.error) errorRef.current?.focus()
  }, [state])

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    setTurnstileResetKey((key) => key + 1)
  }, [])
  const handleTurnstileError = useCallback(
    (message: string) => dispatch({ type: 'failed', message }),
    [],
  )

  const start = useCallback(async (token: string) => {
    if (!token || startingLock.current) return
    startingLock.current = true
    setStarting(true)
    startController.current?.abort()
    const controller = new AbortController()
    startController.current = controller
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 45_000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'start', turnstileToken: token }),
        signal: controller.signal,
      })
      const data = (await response.json()) as StartResponse
      if (!response.ok || !data.schema || !data.contextToken) throw new Error(data.error || 'Unable to start this signup')
      const availability = connectionSchemaAvailability(data.schema.attributes)
      if (!availability.available) {
        setConfigurationError(availability.reason)
        return
      }
      setSchema(data.schema)
      setContextToken(data.contextToken)
      setValues((current) => preserveConnectionSignupValues(data.schema!, current))
      dispatch({ type: 'started' })
    } catch (error) {
      if (!controller.signal.aborted || timedOut) {
        dispatch({ type: 'failed', message: timedOut ? 'The signup took too long to start. Please try again.' : error instanceof Error ? error.message : 'Unable to start this signup' })
      }
    } finally {
      window.clearTimeout(timeout)
      if (startController.current === controller) {
        startController.current = null
        startingLock.current = false
        setStarting(false)
        resetTurnstile()
      }
    }
  }, [endpoint, resetTurnstile])

  if (loadingSiteKey) return <p role="status" aria-live="polite" className="text-dark-grey">Loading signup…</p>
  if (configurationError) {
    return <p role="alert" className="rounded-lg bg-red-50 p-5 text-red-800">{configurationError} Please <a className="font-semibold underline" href="/contact">contact us</a>.</p>
  }
  if (state.phase === 'success') return <ConnectionSignupTerminal kind="success" message={state.message} />
  if (state.phase === 'outcomeUnknown') return <ConnectionSignupTerminal kind="outcomeUnknown" />
  if (!schema || !values) {
    return (
      <div className="space-y-3">
        <p role="status" aria-live="polite" className="text-sm text-dark-grey">{starting ? 'Preparing secure signup…' : 'Complete the security check to begin.'}</p>
        {'error' in state && state.error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 outline-none">{state.error}</p>}
        {siteKey && <TurnstileWidget siteKey={siteKey} action={ROCK_CONNECTION_START_ACTION} resetKey={turnstileResetKey} onToken={start} onError={handleTurnstileError} />}
      </div>
    )
  }

  const isSubmitting = state.phase === 'submitting'
  const contextReady = Boolean(contextToken)
  return (
    <form
      data-analytics-sensitive
      aria-label={schema.opportunityName}
      className="space-y-8"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!turnstileToken) {
          dispatch({ type: 'failed', message: 'Please complete the bot check before submitting.' })
          return
        }
        if (isSubmitting || !claimConnectionSubmission(submitting)) return
        dispatch({ type: 'submitting' })
        submitController.current?.abort()
        const controller = new AbortController()
        submitController.current = controller
        let timedOut = false
        const timeout = window.setTimeout(() => {
          timedOut = true
          controller.abort()
        }, 45_000)
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intent: 'submit',
              turnstileToken,
              contextToken,
              values: buildConnectionSubmissionValues(schema, values),
            }),
            signal: controller.signal,
          })
          const data = (await response.json()) as SubmitResponse
          if (data.outcomeUnknown) {
            dispatch({ type: 'outcomeUnknown' })
          } else if (data.restartRequired) {
            setContextToken('')
            dispatch({
              type: 'failed',
              message:
                data.error ||
                'Please complete the security check to continue.',
            })
          } else if (!response.ok || data.status !== 'complete' || data.resultType !== 0) {
            dispatch({ type: 'failed', message: data.error || 'Unable to submit this signup right now' })
          } else {
            trackSuccessfulFormSubmission(
              window.location.pathname,
              'connection_opportunity',
            )
            dispatch({ type: 'succeeded', message: data.message || 'Thanks. Your request has been received.' })
          }
        } catch {
          if (!controller.signal.aborted || timedOut) {
            dispatch({ type: 'outcomeUnknown' })
          }
        } finally {
          window.clearTimeout(timeout)
          if (submitController.current === controller) {
            submitController.current = null
            submitting.current = false
            resetTurnstile()
          }
        }
      }}
    >
      <fieldset disabled={!contextReady} className="contents">
        <ConnectionSignupFields schema={schema} values={values} onChange={setValues} />
      </fieldset>
      <TurnstileWidget
        siteKey={siteKey}
        action={contextReady ? ROCK_CONNECTION_SUBMIT_ACTION : ROCK_CONNECTION_START_ACTION}
        resetKey={turnstileResetKey}
        onToken={contextReady ? setTurnstileToken : start}
        onError={handleTurnstileError}
      />
      {'error' in state && state.error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 outline-none">{state.error}</p>}
      <button
        className="rounded-full bg-rich-red px-7 py-3 font-semibold text-white transition hover:bg-rich-red/90 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting || !contextReady}
      >
        {isSubmitting ? 'Submitting…' : contextReady ? 'Submit' : 'Preparing…'}
      </button>
    </form>
  )
}
