'use client'

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { HiCalendarDays, HiChevronLeft, HiChevronRight, HiXMark } from 'react-icons/hi2'
import { useRouter } from 'next/navigation'

import { formInputClass, formLabelClass } from '@/components/forms/form-styles'
import type {
  VolunteerScheduleGroup,
  VolunteerScheduleUnavailabilityListResult,
} from '@/lib/members/volunteer-scheduling'

const REQUEST_TIMEOUT_MS = 15_000

function aucklandToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function isoDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function formatDate(value: string) {
  if (!value) return ''
  const { year, month, day } = dateParts(value)
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function CalendarDateRangeField({
  endDate,
  id,
  isOpen,
  min,
  onChange,
  onComplete,
  onOpen,
  startDate,
}: {
  endDate: string
  id: string
  isOpen: boolean
  min: string
  onChange: (startDate: string, endDate: string) => void
  onComplete: () => void
  onOpen: () => void
  startDate: string
}) {
  const initial = startDate || min
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const { year, month } = dateParts(initial)
    return { year, month }
  })
  const minParts = dateParts(min)
  const daysInMonth = new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 0)).getUTCDate()
  const firstWeekday = (new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1)).getUTCDay() + 6) % 7
  const monthLabel = new Intl.DateTimeFormat('en-NZ', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1)))
  const canGoBack = visibleMonth.year > minParts.year ||
    (visibleMonth.year === minParts.year && visibleMonth.month > minParts.month)

  function moveMonth(offset: number) {
    const date = new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1 + offset, 1))
    setVisibleMonth({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 })
  }

  function open() {
    const next = dateParts(startDate || min)
    setVisibleMonth({ year: next.year, month: next.month })
    onOpen()
  }

  function choose(date: string) {
    if (!startDate || endDate || date < startDate) {
      onChange(date, '')
      return
    }
    onChange(startDate, date)
    onComplete()
  }

  return (
    <div className="relative min-w-0">
      <button
        id={id}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-warm-grey bg-white px-4 py-3 text-left text-brand-black outline-none transition hover:border-rich-red/50 focus:border-rich-red focus:ring-2 focus:ring-rich-red/15"
      >
        <span className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className={startDate ? '' : 'text-mid-grey'}>{startDate ? formatDate(startDate) : 'Start date'}</span>
          <span className="text-mid-grey">to</span>
          <span className={endDate ? '' : 'text-mid-grey'}>{endDate ? formatDate(endDate) : 'End date'}</span>
        </span>
        <HiCalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-rich-red" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Date range calendar"
          className="absolute left-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-4rem))] rounded-xl border border-warm-grey bg-white p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => moveMonth(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-brand-black hover:bg-warm-white disabled:opacity-25"
            >
              <HiChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <p className="font-bold text-brand-black">{monthLabel}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-brand-black hover:bg-warm-white"
            >
              <HiChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-xs font-bold text-mid-grey" aria-hidden="true">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-2">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const date = isoDate(visibleMonth.year, visibleMonth.month, day)
              const disabled = date < min
              const rangeStart = date === startDate
              const rangeEnd = date === endDate
              const inRange = Boolean(startDate && endDate && date > startDate && date < endDate)
              const column = (firstWeekday + index) % 7
              const rangeColor = 'rgba(15, 0, 4, 0.06)'
              const rangeBackground = rangeStart && rangeEnd
                ? undefined
                : rangeStart && column < 6
                  ? `linear-gradient(to right, transparent 50%, ${rangeColor} 50%)`
                  : rangeEnd && column > 0
                    ? `linear-gradient(to right, ${rangeColor} 50%, transparent 50%)`
                    : inRange
                      ? rangeColor
                      : undefined
              const friendly = new Intl.DateTimeFormat('en-NZ', {
                day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
              }).format(new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, day)))
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={`Choose ${friendly}`}
                  aria-pressed={rangeStart || rangeEnd}
                  disabled={disabled}
                  onClick={() => choose(date)}
                  style={{ background: rangeBackground }}
                  className={`group flex aspect-square items-center justify-center text-sm text-brand-black outline-none disabled:text-warm-grey ${
                    inRange && column === 0 ? 'rounded-l-full' : inRange && column === 6 ? 'rounded-r-full' : ''
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    rangeStart || rangeEnd
                      ? 'bg-rich-red font-bold text-white shadow-sm'
                      : inRange
                        ? 'font-semibold'
                        : 'group-hover:ring-1 group-hover:ring-rich-red/35 group-focus-visible:ring-2 group-focus-visible:ring-rich-red group-disabled:ring-0'
                  }`}>
                    {day}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ScheduleUnavailability({
  groups,
  groupsUnavailable = false,
  isImpersonating,
  onSaved,
}: {
  groups: VolunteerScheduleGroup[]
  groupsUnavailable?: boolean
  isImpersonating: boolean
  onSaved?: () => void
}) {
  const router = useRouter()
  const today = useMemo(aucklandToday, [])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [groupId, setGroupId] = useState('')
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  function close() {
    if (isSaving) return
    setIsOpen(false)
    setIsDatePickerOpen(false)
    setMessage(null)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.documentElement.style.overflow = previousOverflow
    }
  }, [isOpen, isSaving])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || isImpersonating) return
    setMessage(null)
    if (!startDate || !endDate || startDate < today || endDate < startDate) {
      setMessage({
        kind: 'error',
        text: startDate && endDate && endDate < startDate
          ? 'The end date must be on or after the start date.'
          : 'Choose a current or future start and end date.',
      })
      return
    }
    if (!groupId) {
      setMessage({ kind: 'error', text: 'Choose the serving group this applies to.' })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/member-service/unavailability', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          notes,
          groupId: Number(groupId),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const result = await response.json().catch(() => null) as { status?: unknown } | null
      if (response.ok && result?.status === 'saved') {
        setStartDate('')
        setEndDate('')
        setNotes('')
        setGroupId('')
        setIsDatePickerOpen(false)
        setIsOpen(false)
        if (onSaved) {
          setMessage(null)
          onSaved()
        } else {
          setMessage({ kind: 'success', text: 'Your unavailability has been saved.' })
        }
        window.requestAnimationFrame(() => triggerRef.current?.focus())
        router.refresh()
        return
      }
      if (response.status === 401) {
        setMessage({ kind: 'error', text: 'Your session has expired. Sign in again before saving.' })
      } else if (response.status === 400) {
        setMessage({ kind: 'error', text: 'Check the dates and try again.' })
      } else if (result?.status === 'outcome-unknown') {
        setMessage({
          kind: 'error',
          text: 'We could not confirm whether Rock saved this. Check your unavailability before trying again.',
        })
      } else {
        setMessage({ kind: 'error', text: 'Rock could not save your unavailability. Please try again.' })
      }
    } catch {
      setMessage({
        kind: 'error',
        text: 'We could not confirm whether Rock saved this. Check your unavailability before trying again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      {groupsUnavailable ? (
        <p role="status" className="text-sm text-mid-grey">Scheduling is temporarily unavailable.</p>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          disabled={isImpersonating || groups.length === 0}
          onClick={() => {
            setMessage(null)
            setIsOpen(true)
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rich-red px-5 py-2 text-sm font-bold text-rich-red transition-colors hover:bg-rich-red hover:text-white disabled:cursor-not-allowed disabled:border-mid-grey disabled:text-mid-grey"
        >
          <HiCalendarDays aria-hidden="true" className="h-5 w-5" />
          Schedule unavailability
        </button>
      )}
      {isImpersonating && (
        <p role="status" className="mt-2 text-sm text-mid-grey">
          Unavailability is read-only while impersonating a member.
        </p>
      )}
      {!groupsUnavailable && !isImpersonating && groups.length === 0 && (
        <p role="status" className="mt-2 text-sm text-mid-grey">
          No serving groups are available.
        </p>
      )}
      {message?.kind === 'success' && (
        <p role="status" className="mt-4 rounded-xl border border-newish-green/25 bg-newish-green/10 px-4 py-3 text-sm text-brand-black">
          {message.text}
        </p>
      )}

      {isOpen && !groupsUnavailable && !isImpersonating && groups.length > 0 && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-brand-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-unavailability-heading"
            aria-describedby="schedule-unavailability-description"
            className="relative my-auto w-full max-w-2xl rounded-2xl bg-warm-white p-6 shadow-2xl sm:p-8"
          >
            <button
              ref={closeRef}
              type="button"
              aria-label="Close schedule unavailability"
              disabled={isSaving}
              onClick={close}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-brand-black/60 hover:bg-brand-black/5 disabled:opacity-60 sm:right-4 sm:top-4"
            >
              <HiXMark aria-hidden="true" className="h-7 w-7" />
            </button>
            <h2 id="schedule-unavailability-heading" className="pr-14 text-3xl text-brand-black">
              Schedule unavailability
            </h2>
            <p id="schedule-unavailability-description" className="mt-2 text-sm leading-relaxed text-mid-grey">
              Let the scheduling team know when you’re unavailable to serve.
            </p>

            <form noValidate onSubmit={(event) => void submit(event)} className="mt-6 grid gap-5">
          <fieldset>
            <legend className={formLabelClass}>Date range <span className="text-rich-red" aria-hidden="true">*</span></legend>
            <div className="mt-2">
              <label className="sr-only" htmlFor="unavailability-date-range">Date range</label>
              <CalendarDateRangeField
                id="unavailability-date-range"
                min={today}
                startDate={startDate}
                endDate={endDate}
                isOpen={isDatePickerOpen}
                onOpen={() => setIsDatePickerOpen((open) => !open)}
                onComplete={() => setIsDatePickerOpen(false)}
                onChange={(start, end) => {
                  setStartDate(start)
                  setEndDate(end)
                }}
              />
            </div>
          </fieldset>

          <label className={formLabelClass} htmlFor="unavailability-notes">
            Unavailability notes <span className="font-normal text-mid-grey">(optional)</span>
            <textarea
              id="unavailability-notes"
              rows={3}
              maxLength={100}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${formInputClass} resize-y`}
            />
          </label>

          <div>
            <label className={formLabelClass} htmlFor="unavailability-group">
              Group <span className="text-rich-red" aria-hidden="true">*</span>
            </label>
            <div className="relative">
            <select
              id="unavailability-group"
              aria-required="true"
              required
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className={`${formInputClass} min-h-12 appearance-none pr-11`}
            >
              <option value="">Select a serving group</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
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
          </div>

          {message?.kind === 'error' && (
            <p
              role="alert"
              className="rounded-lg border border-rich-red/20 bg-rich-red/5 px-4 py-3 text-sm text-rich-red"
            >
              {message.text}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={close}
              className="min-h-11 rounded-full border border-dark-grey px-5 py-2 text-sm font-bold text-dark-grey disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 rounded-full bg-rich-red px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-black disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save unavailability'}
            </button>
          </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export function UpcomingUnavailability({
  action,
  isImpersonating,
  notice,
  onDismissNotice,
  unavailability,
}: {
  action?: ReactNode
  isImpersonating: boolean
  notice?: { kind: 'error' | 'success'; text: string } | null
  onDismissNotice?: () => void
  unavailability: VolunteerScheduleUnavailabilityListResult
}) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [removeMessage, setRemoveMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const removeDialogRef = useRef<HTMLElement>(null)
  const removeTriggerRef = useRef<HTMLButtonElement>(null)
  const exclusions = unavailability.status === 'available'
    ? unavailability.exclusions.filter(({ id }) => !removedIds.includes(id))
    : []
  const confirmingExclusion = exclusions.find(({ id }) => id === confirmingId) ?? null
  const visibleMessage = removeMessage ?? notice

  function closeRemoveDialog() {
    if (removingId) return
    setConfirmingId(null)
    window.requestAnimationFrame(() => removeTriggerRef.current?.focus())
  }

  useEffect(() => {
    if (notice) setRemoveMessage(null)
  }, [notice])

  useEffect(() => {
    if (!confirmingId) return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRemoveDialog()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(removeDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.documentElement.style.overflow = previousOverflow
    }
  }, [confirmingId, removingId])

  async function remove(id: string) {
    if (removingId || isImpersonating) return
    setRemovingId(id)
    setRemoveMessage(null)
    try {
      const response = await fetch('/api/member-service/unavailability', {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const result = await response.json().catch(() => null) as { status?: unknown } | null
      if (response.ok && result?.status === 'deleted') {
        setRemovedIds((current) => [...current, id])
        setConfirmingId(null)
        onDismissNotice?.()
        setRemoveMessage({ kind: 'success', text: 'Your scheduled unavailability has been removed.' })
        router.refresh()
        return
      }
      if (response.status === 401) {
        setRemoveMessage({ kind: 'error', text: 'Your session has expired. Sign in again before removing this.' })
      } else if (result?.status === 'outcome-unknown') {
        setRemoveMessage({ kind: 'error', text: 'We could not confirm whether Rock removed this. Refresh before trying again.' })
      } else {
        setRemoveMessage({ kind: 'error', text: 'Rock could not remove this unavailability. Please try again.' })
      }
    } catch {
      setRemoveMessage({ kind: 'error', text: 'We could not confirm whether Rock removed this. Refresh before trying again.' })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <section aria-labelledby="upcoming-unavailability-heading" className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="upcoming-unavailability-heading" className="text-xl text-brand-black">
          Upcoming unavailability
        </h2>
        {action}
      </div>
      {visibleMessage && !(confirmingExclusion && removeMessage?.kind === 'error') && (
        <p
          role={visibleMessage.kind === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
            visibleMessage.kind === 'error'
              ? 'border-rich-red/20 bg-rich-red/5 text-rich-red'
              : 'border-newish-green/25 bg-newish-green/10 text-brand-black'
          }`}
        >
          {visibleMessage.text}
        </p>
      )}
      {unavailability.status === 'unavailable' ? (
        <p className="mt-3 text-sm text-mid-grey">
          Your saved unavailability is temporarily unavailable.
        </p>
      ) : exclusions.length === 0 ? (
        <p className="mt-3 rounded-xl border border-warm-grey bg-white p-4 text-sm leading-relaxed text-mid-grey">
          You have no upcoming unavailability.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-warm-grey rounded-xl border border-warm-grey bg-white">
          {exclusions.map((exclusion) => (
            <li key={exclusion.id} className="flex items-start gap-3 px-4 py-4">
              <HiCalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rich-red" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-brand-black">
                  <time dateTime={exclusion.startDate}>{formatDate(exclusion.startDate)}</time>
                  {' – '}
                  <time dateTime={exclusion.endDate}>{formatDate(exclusion.endDate)}</time>
                </p>
                <p className="mt-0.5 text-sm text-dark-grey">{exclusion.groupName}</p>
                {exclusion.notes && <p className="mt-1 text-sm text-mid-grey">{exclusion.notes}</p>}
              </div>
              {!isImpersonating && (
                <button
                  type="button"
                  aria-label={`Remove unavailability from ${formatDate(exclusion.startDate)} to ${formatDate(exclusion.endDate)}`}
                  title="Remove"
                  disabled={Boolean(removingId)}
                  onClick={(event) => {
                    removeTriggerRef.current = event.currentTarget
                    setConfirmingId(exclusion.id)
                    setRemoveMessage(null)
                    onDismissNotice?.()
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rich-red text-rich-red transition-colors hover:bg-rich-red hover:text-white disabled:opacity-60"
                >
                  <HiXMark aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">Remove</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmingExclusion && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-brand-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRemoveDialog()
          }}
        >
          <section
            ref={removeDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-unavailability-heading"
            aria-describedby="remove-unavailability-description"
            className="relative my-auto w-full max-w-md rounded-2xl bg-warm-white p-6 shadow-2xl sm:p-8"
          >
            <button
              type="button"
              aria-label="Close remove unavailability"
              disabled={Boolean(removingId)}
              onClick={closeRemoveDialog}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-brand-black/60 hover:bg-brand-black/5 disabled:opacity-60 sm:right-4 sm:top-4"
            >
              <HiXMark aria-hidden="true" className="h-7 w-7" />
            </button>
            <h2 id="remove-unavailability-heading" className="pr-14 text-2xl text-brand-black">
              Remove unavailability?
            </h2>
            <p id="remove-unavailability-description" className="mt-3 text-sm leading-relaxed text-mid-grey">
              {formatDate(confirmingExclusion.startDate)} – {formatDate(confirmingExclusion.endDate)} · {confirmingExclusion.groupName}
            </p>
            {removeMessage?.kind === 'error' && (
              <p role="alert" className="mt-4 rounded-lg border border-rich-red/20 bg-rich-red/5 px-4 py-3 text-sm text-rich-red">
                {removeMessage.text}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                disabled={Boolean(removingId)}
                onClick={closeRemoveDialog}
                className="min-h-11 rounded-full border border-dark-grey px-5 py-2 text-sm font-bold text-dark-grey disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(removingId)}
                onClick={() => void remove(confirmingExclusion.id)}
                className="min-h-11 rounded-full bg-rich-red px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-black disabled:cursor-wait disabled:opacity-60"
              >
                {removingId ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export function UnavailabilitySection({
  groups,
  groupsUnavailable = false,
  isImpersonating,
  unavailability,
}: {
  groups: VolunteerScheduleGroup[]
  groupsUnavailable?: boolean
  isImpersonating: boolean
  unavailability: VolunteerScheduleUnavailabilityListResult
}) {
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  return (
    <UpcomingUnavailability
      isImpersonating={isImpersonating}
      unavailability={unavailability}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      action={(
        <ScheduleUnavailability
          groups={groups}
          groupsUnavailable={groupsUnavailable}
          isImpersonating={isImpersonating}
          onSaved={() => setNotice({
            kind: 'success',
            text: 'Your unavailability has been saved.',
          })}
        />
      )}
    />
  )
}
