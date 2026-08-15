'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { HiCheck, HiXMark } from 'react-icons/hi2'

import { formInputClass } from '@/components/forms/form-styles'
import { MEMBER_NOTIFICATIONS_REFRESH_EVENT } from '@/lib/member-notification-contract'
import type {
  VolunteerScheduleAssignment,
  VolunteerScheduleDeclineReason,
  VolunteerScheduleResult,
} from '@/lib/members/volunteer-scheduling'

const RETURN_REFRESH_THROTTLE_MS = 5_000
const REFRESH_FALLBACK_MS = 8_000
const RESPONSE_TIMEOUT_MS = 15_000
const DIALOG_TRANSITION_MS = 200

const occurrenceDateFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const occurrenceFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

type AssignmentState = 'request' | 'confirmed' | 'declined'
const LEADING_WEEKDAY_PATTERN = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/iu

interface AssignmentGroup {
  key: string
  occurrenceStart: string
  scheduleName: string | null
  locationName: string | null
  assignments: Array<{
    assignment: VolunteerScheduleAssignment
    state: AssignmentState
  }>
}

function groupAssignments(assignments: Array<{
  assignment: VolunteerScheduleAssignment
  state: AssignmentState
}>): AssignmentGroup[] {
  const groups = new Map<string, AssignmentGroup>()
  for (const item of assignments) {
    const { assignment } = item
    const key = [assignment.occurrenceStart, assignment.scheduleName, assignment.locationName].join('|')
    const group = groups.get(key)
    if (group) group.assignments.push(item)
    else groups.set(key, {
      key,
      occurrenceStart: assignment.occurrenceStart,
      scheduleName: assignment.scheduleName,
      locationName: assignment.locationName,
      assignments: [item],
    })
  }
  const stateOrder: Record<AssignmentState, number> = {
    request: 0,
    confirmed: 1,
    declined: 2,
  }
  for (const group of groups.values()) {
    group.assignments.sort((left, right) =>
      stateOrder[left.state] - stateOrder[right.state] ||
      left.assignment.title.localeCompare(right.assignment.title),
    )
  }
  return [...groups.values()].sort((left, right) => {
    const leftNeedsResponse = left.assignments.some(({ state }) => state === 'request')
    const rightNeedsResponse = right.assignments.some(({ state }) => state === 'request')
    return Number(rightNeedsResponse) - Number(leftNeedsResponse) ||
      Date.parse(left.occurrenceStart) - Date.parse(right.occurrenceStart)
  })
}

function AssignmentStatus({ state }: { state: AssignmentState }) {
  const label = state === 'request' ? 'Response requested' : state === 'confirmed' ? 'Confirmed' : 'Declined'
  if (state === 'request') return (
    <span
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-brand-black"
    >
      <span aria-hidden="true">?</span>
    </span>
  )
  const confirmed = state === 'confirmed'
  return (
    <span
      aria-label={label}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${confirmed ? 'bg-newish-green' : 'bg-rich-red'}`}
    >
      {confirmed
        ? <HiCheck aria-hidden="true" className="h-4 w-4" />
        : <HiXMark aria-hidden="true" className="h-4 w-4" />}
    </span>
  )
}

interface ScheduleResponseError {
  id: string
  message: string
  signIn?: boolean
}

function ResponseErrorMessage({ error }: { error: ScheduleResponseError }) {
  return (
    <div role="alert" className="mt-2 rounded-lg border border-rich-red/20 bg-rich-red/5 px-4 py-3 text-sm leading-relaxed text-rich-red">
      <p>{error.message}</p>
      {error.signIn && (
        <a
          href="/auth/login?returnTo=%2Fmembers%2Fmy-service"
          rel="nofollow"
          className="mt-2 inline-block min-h-11 py-2 font-bold underline"
        >
          Sign in again
        </a>
      )}
    </div>
  )
}

function ServiceCard({
  group,
  responseError,
  renderActions,
}: {
  group: AssignmentGroup
  responseError: ScheduleResponseError | null
  renderActions: (assignment: VolunteerScheduleAssignment, state: AssignmentState) => React.ReactNode
}) {
  const serviceName = group.scheduleName?.replace(LEADING_WEEKDAY_PATTERN, '') ?? null
  const serviceDetails = [serviceName, group.locationName]
    .filter((value): value is string => Boolean(value))

  const groupError = responseError && group.assignments.some(
    ({ assignment }) => assignment.id === responseError.id,
  ) ? responseError : null

  return (
    <div className="min-w-0">
      <article className="rounded-xl border border-warm-grey bg-white shadow-sm shadow-brand-black/5">
      <header className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <time dateTime={group.occurrenceStart} className="block text-base font-bold text-brand-black">
          {occurrenceDateFormatter.format(new Date(group.occurrenceStart))}
        </time>
        {serviceDetails.length > 0 && (
          <p className="mt-0.5 text-sm text-mid-grey">{serviceDetails.join(' – ')}</p>
        )}
      </header>
      <div className="border-t border-warm-grey px-4 sm:px-5">
        {group.assignments.map(({ assignment, state }) => (
          <div
            key={assignment.id}
            id={assignment.id}
            tabIndex={-1}
            className="scroll-mt-32 border-t border-warm-grey py-3 first:border-t-0"
          >
            <div className="flex items-center gap-3">
              <AssignmentStatus state={state} />
              <h3 className="min-w-0 flex-1 text-base font-bold leading-tight text-brand-black">
                {assignment.title}
              </h3>
              {renderActions(assignment, state)}
            </div>
          </div>
        ))}
      </div>
      </article>
      {groupError && <ResponseErrorMessage error={groupError} />}
    </div>
  )
}

function ResponseControls({
  assignment,
  acceptLabel,
  allowDecline,
  disabled,
  respondingId,
  onAccept,
  onRequestDecline,
}: {
  assignment: VolunteerScheduleAssignment
  acceptLabel: 'Accept' | 'Reconfirm' | null
  allowDecline: boolean
  disabled: boolean
  respondingId: string | null
  onAccept: () => void
  onRequestDecline: (trigger: HTMLButtonElement) => void
}) {
  return (
    <div className="shrink-0">
      <div className="flex gap-2">
        {acceptLabel && (
          <button
            type="button"
            aria-label={`${acceptLabel} ${assignment.title}`}
            title={acceptLabel}
            disabled={disabled}
            onClick={onAccept}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-newish-green text-newish-green transition-colors hover:bg-newish-green hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            <HiCheck aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">{respondingId === assignment.id ? 'Saving' : acceptLabel}</span>
          </button>
        )}
        {allowDecline && (
          <button
            type="button"
            aria-label={`Decline ${assignment.title}`}
            title="Decline"
            disabled={disabled}
            onClick={(event) => onRequestDecline(event.currentTarget)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-rich-red text-rich-red transition-colors hover:bg-rich-red hover:text-white disabled:opacity-60"
          >
            <HiXMark aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Decline</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function VolunteerSchedule({
  schedule,
  declineReasons = [],
  isImpersonating,
}: {
  schedule: VolunteerScheduleResult
  declineReasons?: VolunteerScheduleDeclineReason[]
  isImpersonating: boolean
}) {
  const router = useRouter()
  const lastReturnRefreshAt = useRef(0)
  const refreshFallbackRef = useRef<number | null>(null)
  const refreshRequestedRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const refreshAfterFlightRef = useRef(false)
  const refreshCanonicalScheduleRef = useRef<(force?: boolean) => void>(() => {})
  const respondingRef = useRef(false)
  const responseAbortRef = useRef<AbortController | null>(null)
  const lastFocusedHashRef = useRef('')
  const declineTriggerRef = useRef<HTMLButtonElement | null>(null)
  const declineCancelRef = useRef<HTMLButtonElement | null>(null)
  const declineDialogRef = useRef<HTMLElement | null>(null)
  const declineCloseTimeoutRef = useRef<number | null>(null)
  const declineDialogTitleId = `decline-service-${useId().replace(/:/gu, '')}`
  const declineDialogDescriptionId = `${declineDialogTitleId}-description`
  const previousRequestIdsRef = useRef(new Set(
    schedule.status === 'available' ? schedule.requests.map(({ id }) => id) : [],
  ))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [refreshAnnouncement, setRefreshAnnouncement] = useState('')
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [confirmDeclineId, setConfirmDeclineId] = useState<string | null>(null)
  const [isDeclineDialogVisible, setIsDeclineDialogVisible] = useState(false)
  const [declineReasonId, setDeclineReasonId] = useState<number | null>(null)
  const [responseError, setResponseError] = useState<ScheduleResponseError | null>(null)
  const [assignmentStateOverrides, setAssignmentStateOverrides] = useState<Map<string, AssignmentState>>(
    () => new Map(),
  )

  const closeDeclineDialog = useCallback(() => {
    const trigger = declineTriggerRef.current
    setIsDeclineDialogVisible(false)
    if (declineCloseTimeoutRef.current !== null) {
      window.clearTimeout(declineCloseTimeoutRef.current)
    }
    declineCloseTimeoutRef.current = window.setTimeout(() => {
      setConfirmDeclineId(null)
      setDeclineReasonId(null)
      declineCloseTimeoutRef.current = null
      trigger?.focus()
    }, DIALOG_TRANSITION_MS)
  }, [])

  const refreshCanonicalSchedule = useCallback((force = false) => {
    if (refreshInFlightRef.current) {
      if (force) refreshAfterFlightRef.current = true
      return
    }
    const now = Date.now()
    if (!force && now - lastReturnRefreshAt.current < RETURN_REFRESH_THROTTLE_MS) return
    lastReturnRefreshAt.current = now
    refreshInFlightRef.current = true
    refreshRequestedRef.current = true
    setRefreshFailed(false)
    setIsRefreshing(true)
    router.refresh()
    if (refreshFallbackRef.current !== null) window.clearTimeout(refreshFallbackRef.current)
    refreshFallbackRef.current = window.setTimeout(() => {
      refreshInFlightRef.current = false
      if (refreshAfterFlightRef.current) {
        refreshAfterFlightRef.current = false
        refreshCanonicalSchedule(true)
        return
      }
      setIsRefreshing(false)
      setRefreshFailed(true)
    }, REFRESH_FALLBACK_MS)
  }, [router])
  refreshCanonicalScheduleRef.current = refreshCanonicalSchedule

  useEffect(() => {
    refreshInFlightRef.current = false
    setIsRefreshing(false)
    setRefreshFailed(false)
    if (refreshFallbackRef.current !== null) window.clearTimeout(refreshFallbackRef.current)
    if (schedule.status !== 'available') return

    const nextRequestIds = new Set(schedule.requests.map(({ id }) => id))
    const nextAssignmentStates = new Map<string, AssignmentState>([
      ...schedule.requests.map(({ id }) => [id, 'request'] as const),
      ...schedule.upcoming.map(({ id }) => [id, 'confirmed'] as const),
      ...schedule.declined.map(({ id }) => [id, 'declined'] as const),
    ])
    if (refreshRequestedRef.current) {
      const removed = [...previousRequestIdsRef.current]
        .filter((id) => !nextRequestIds.has(id))
      if (removed.length > 0) {
        const movedToUpcoming = removed.some((id) =>
          schedule.upcoming.some((assignment) => assignment.id === id),
        )
        const movedToDeclined = removed.some((id) =>
          schedule.declined.some((assignment) => assignment.id === id),
        )
        setRefreshAnnouncement(
          movedToUpcoming
            ? 'Your service response is confirmed and has moved to Upcoming.'
            : movedToDeclined
              ? 'Your service response is saved and has moved to Declined.'
              : 'A service request is no longer available.',
        )
      }
      refreshRequestedRef.current = false
    }
    setAssignmentStateOverrides((current) => {
      const retained = new Map<string, AssignmentState>()
      for (const [id, state] of current) {
        const canonicalState = nextAssignmentStates.get(id)
        if (canonicalState && canonicalState !== state) retained.set(id, state)
      }
      return retained.size === current.size ? current : retained
    })
    previousRequestIdsRef.current = nextRequestIds
    if (refreshAfterFlightRef.current) {
      refreshAfterFlightRef.current = false
      refreshCanonicalScheduleRef.current(true)
    }
  }, [schedule])

  useEffect(() => () => {
    if (refreshFallbackRef.current !== null) window.clearTimeout(refreshFallbackRef.current)
    if (declineCloseTimeoutRef.current !== null) window.clearTimeout(declineCloseTimeoutRef.current)
    responseAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!confirmDeclineId) return
    const remainsActionable = schedule.status === 'available' &&
      [...schedule.requests, ...schedule.upcoming].some(({ id }) => id === confirmDeclineId)
    if (!remainsActionable) closeDeclineDialog()
  }, [closeDeclineDialog, confirmDeclineId, schedule])

  useEffect(() => {
    if (!confirmDeclineId) return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const animationFrame = window.requestAnimationFrame(() => {
      setIsDeclineDialogVisible(true)
      declineCancelRef.current?.focus()
    })
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDeclineDialog()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(declineDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.cancelAnimationFrame(animationFrame)
      document.documentElement.style.overflow = previousOverflow
    }
  }, [closeDeclineDialog, confirmDeclineId])

  useEffect(() => {
    function focusScheduleTarget() {
      try {
        const hash = window.location.hash
        if (!hash) {
          lastFocusedHashRef.current = ''
          return
        }
        if (lastFocusedHashRef.current === hash) return
        const targetId = decodeURIComponent(hash.slice(1))
        const target = targetId.startsWith('rock-schedule:')
          ? document.getElementById(targetId)
          : null
        if (target) {
          target.focus()
          lastFocusedHashRef.current = hash
        }
      } catch {
        // Ignore malformed fragments that are not generated by the notification adapter.
      }
    }
    focusScheduleTarget()
    window.addEventListener('hashchange', focusScheduleTarget)
    return () => window.removeEventListener('hashchange', focusScheduleTarget)
  }, [schedule])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshCanonicalSchedule(false)
    }
    const refreshOnFocus = () => refreshCanonicalSchedule(false)
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshCanonicalSchedule])

  const respond = useCallback(async (
    assignment: VolunteerScheduleAssignment,
    response: 'accept' | 'decline',
    selectedDeclineReasonId?: number,
  ) => {
    if (respondingRef.current) return
    respondingRef.current = true
    setRespondingId(assignment.id)
    if (response === 'decline') closeDeclineDialog()
    setResponseError(null)
    setAssignmentStateOverrides((current) => {
      const next = new Map(current)
      next.set(assignment.id, response === 'accept' ? 'confirmed' : 'declined')
      return next
    })
    const rollbackOptimisticState = () => {
      setAssignmentStateOverrides((current) => {
        if (!current.has(assignment.id)) return current
        const next = new Map(current)
        next.delete(assignment.id)
        return next
      })
    }
    try {
      const controller = new AbortController()
      responseAbortRef.current = controller
      const providerResponse = await fetch('/api/member-service/respond', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentId: assignment.id,
          response,
          ...(response === 'decline' ? { declineReasonId: selectedDeclineReasonId } : {}),
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(RESPONSE_TIMEOUT_MS)]),
      })
      const result = await providerResponse.json().catch(() => null) as { status?: unknown } | null
      if (
        providerResponse.ok &&
        (result?.status === 'accepted' || result?.status === 'declined')
      ) {
        setAssignmentStateOverrides((current) => {
          const next = new Map(current)
          next.set(assignment.id, result.status === 'accepted' ? 'confirmed' : 'declined')
          return next
        })
        const wasDeclined = schedule.status === 'available' &&
          schedule.declined.some(({ id }) => id === assignment.id)
        setRefreshAnnouncement(
          result.status === 'accepted'
            ? `${assignment.title} ${wasDeclined ? 'reconfirmed' : 'accepted'}. Your schedule is refreshing.`
            : `${assignment.title} declined. Your schedule is refreshing.`,
        )
        window.dispatchEvent(new Event(MEMBER_NOTIFICATIONS_REFRESH_EVENT))
        refreshCanonicalSchedule(true)
        return
      }
      if (providerResponse.status === 409) {
        rollbackOptimisticState()
        setRefreshAnnouncement('That request has changed in Rock. Your schedule is refreshing.')
        window.dispatchEvent(new Event(MEMBER_NOTIFICATIONS_REFRESH_EVENT))
        refreshCanonicalSchedule(true)
        return
      }
      if (providerResponse.status === 400 && result?.status === 'invalid-request') {
        rollbackOptimisticState()
        setResponseError({
          id: assignment.id,
          message: 'Your response could not be submitted. Refresh the page and try again.',
        })
        return
      }
      if (providerResponse.status === 401 && result?.status === 'auth-required') {
        rollbackOptimisticState()
        setResponseError({
          id: assignment.id,
          message: 'Your session has expired. Sign in again before responding.',
          signIn: true,
        })
        return
      }
      if (providerResponse.status === 403 && result?.status === 'forbidden') {
        rollbackOptimisticState()
        setResponseError({
          id: assignment.id,
          message: 'This schedule is read-only in your current session. Refresh the page.',
        })
        return
      }
      const outcomeUnknown = result?.status === 'outcome-unknown'
      rollbackOptimisticState()
      setResponseError({
        id: assignment.id,
        message: outcomeUnknown
          ? 'We could not confirm whether Rock saved your response. Refresh before trying again.'
          : 'Rock could not save your response. Please try again.',
      })
      if (outcomeUnknown) refreshCanonicalSchedule(true)
    } catch {
      rollbackOptimisticState()
      setResponseError({
        id: assignment.id,
        message: 'We could not confirm whether Rock saved your response. Refresh before trying again.',
      })
      refreshCanonicalSchedule(true)
    } finally {
      responseAbortRef.current = null
      respondingRef.current = false
      setRespondingId(null)
    }
  }, [closeDeclineDialog, refreshCanonicalSchedule, schedule])

  if (schedule.status === 'unavailable') {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-warm-grey bg-white p-7 sm:p-8"
      >
        <h2 className="text-2xl text-brand-black">Your schedule is temporarily unavailable</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mid-grey">
          We could not safely load your current serving schedule from Rock. Please try again.
        </p>
        <button
          type="button"
          disabled={isRefreshing}
          onClick={() => refreshCanonicalSchedule(true)}
          className="mt-5 min-h-11 rounded-full bg-rich-red px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-black focus:outline-none focus:ring-4 focus:ring-light-red-2"
        >
          {isRefreshing ? 'Refreshing…' : 'Retry'}
        </button>
      </div>
    )
  }

  const serviceGroups = groupAssignments([
    ...schedule.requests.map((assignment) => ({
      assignment,
      state: assignmentStateOverrides.get(assignment.id) ?? 'request' as const,
    })),
    ...schedule.upcoming.map((assignment) => ({
      assignment,
      state: assignmentStateOverrides.get(assignment.id) ?? 'confirmed' as const,
    })),
    ...schedule.declined.map((assignment) => ({
      assignment,
      state: assignmentStateOverrides.get(assignment.id) ?? 'declined' as const,
    })),
  ])
  const declineAssignment = [...schedule.requests, ...schedule.upcoming]
    .find(({ id }) => id === confirmDeclineId) ?? null
  const declineIsRequest = schedule.requests.some(({ id }) => id === confirmDeclineId)
  const isCompletelyEmpty = serviceGroups.length === 0
  const responseDisabled = respondingId !== null || isRefreshing || refreshFailed

  return (
    <div className="space-y-7">
      <p aria-live="polite" role="status" className="sr-only">
        {refreshAnnouncement}
      </p>
      {isImpersonating && (
        <p role="status" className="rounded-xl border border-warm-grey bg-white px-5 py-4 text-sm text-dark-grey">
          This serving schedule is read-only while impersonating a member.
        </p>
      )}

      {isRefreshing && (
        <p role="status" className="sr-only">
          Refreshing your current schedule…
        </p>
      )}

      {refreshFailed && (
        <div role="alert" className="text-sm text-dark-grey">
          <p>We could not confirm your latest schedule. Refresh before responding.</p>
          <button
            type="button"
            onClick={() => refreshCanonicalSchedule(true)}
            className="mt-2 min-h-11 font-bold text-rich-red"
          >
            Retry refresh
          </button>
        </div>
      )}

      {isCompletelyEmpty ? (
        <p className="rounded-xl border border-warm-grey bg-white p-4 text-sm leading-relaxed text-mid-grey">
          You have no upcoming serving assignments.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {serviceGroups.map((group) => (
            <ServiceCard
              key={group.key}
              group={group}
              responseError={responseError}
              renderActions={(assignment, state) => !isImpersonating && (
                <ResponseControls
                  assignment={assignment}
                  acceptLabel={state === 'request' ? 'Accept' : state === 'declined' ? 'Reconfirm' : null}
                  allowDecline={state !== 'declined'}
                  disabled={responseDisabled}
                  respondingId={respondingId}
                  onAccept={() => void respond(assignment, 'accept')}
                  onRequestDecline={(trigger) => {
                    declineTriggerRef.current = trigger
                    if (declineCloseTimeoutRef.current !== null) {
                      window.clearTimeout(declineCloseTimeoutRef.current)
                      declineCloseTimeoutRef.current = null
                    }
                    setIsDeclineDialogVisible(false)
                    setDeclineReasonId(null)
                    setConfirmDeclineId(assignment.id)
                  }}
                />
              )}
            />
          ))}
        </div>
      )}

      {declineAssignment && (
        <div
          className={`fixed inset-0 z-[80] flex items-center justify-center bg-brand-black/65 p-4 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            isDeclineDialogVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeclineDialog()
          }}
        >
          <section
            ref={declineDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={declineDialogTitleId}
            aria-describedby={declineDialogDescriptionId}
            className={`relative w-full max-w-md rounded-2xl bg-warm-white p-6 shadow-2xl transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none sm:p-8 ${
              isDeclineDialogVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.98] opacity-0'
            }`}
          >
            <button
              type="button"
              aria-label="Close decline dialog"
              disabled={respondingId !== null}
              onClick={closeDeclineDialog}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-brand-black/60 hover:bg-brand-black/5 disabled:opacity-60 sm:right-4 sm:top-4"
            >
              <span aria-hidden="true" className="text-3xl leading-none">×</span>
            </button>
            <h2 id={declineDialogTitleId} className="pr-14 text-3xl text-brand-black">
              {declineIsRequest ? 'Decline this request?' : 'Decline this commitment?'}
            </h2>
            <p id={declineDialogDescriptionId} className="mt-3 text-sm leading-6 text-dark-grey">
              You’re declining {declineAssignment.title} on{' '}
              {occurrenceFormatter.format(new Date(declineAssignment.occurrenceStart))}.
            </p>
            <label className="mt-5 block text-sm font-bold text-brand-black" htmlFor={`${declineDialogTitleId}-reason`}>
              Why can’t you serve?
            </label>
            <div className="relative">
              <select
                id={`${declineDialogTitleId}-reason`}
                value={declineReasonId ?? ''}
                onChange={(event) => setDeclineReasonId(Number(event.target.value) || null)}
                className={`${formInputClass} min-h-11 appearance-none pr-11 text-sm`}
              >
                <option value="">Select a reason</option>
                {declineReasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>{reason.label}</option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="pointer-events-none absolute right-4 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-mid-grey"
              >
                <path d="m5.5 7.5 4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {declineReasons.length === 0 && (
              <p role="alert" className="mt-2 text-sm text-rich-red">
                Decline reasons are temporarily unavailable. Refresh the page and try again.
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={declineCancelRef}
                type="button"
                disabled={respondingId !== null}
                onClick={closeDeclineDialog}
                className="min-h-11 rounded-full border border-dark-grey px-5 py-2 text-sm font-bold text-dark-grey disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={respondingId !== null || declineReasonId === null}
                onClick={() => declineReasonId !== null && void respond(
                  declineAssignment,
                  'decline',
                  declineReasonId,
                )}
                className="min-h-11 rounded-full bg-rich-red px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {respondingId === declineAssignment.id ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
