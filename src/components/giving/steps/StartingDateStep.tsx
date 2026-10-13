import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { assertFixedRecurringPaymentInput } from '@/lib/giving/blinkpay/validation'

import type { GivingFrequency } from '../giving-state'

function nzDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function upcomingWeekday(value: string, weekday: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return addCalendarDays(value, (weekday - date.getUTCDay() + 7) % 7)
}

function nextDayOfMonth(value: string, targetDay: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + (day > targetDay ? 1 : 0), targetDay))
  return date.toISOString().slice(0, 10)
}

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function isoDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function HorizontalPickerRow({ label, children }: { label: string; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, startScroll: 0 })
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    drag.current.active = false
    if (viewport.current?.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      className="-mx-5 w-[calc(100%+2.5rem)] max-w-none cursor-grab select-none overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] active:cursor-grabbing [&_*]:select-none [&::-webkit-scrollbar]:hidden"
      data-scroll-viewport
      onClickCapture={(event) => {
        if (!drag.current.moved) return
        event.preventDefault()
        event.stopPropagation()
        drag.current.moved = false
      }}
      onDragStart={(event) => event.preventDefault()}
      onPointerCancel={finishDrag}
      onPointerDown={(event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return
        drag.current = { active: true, moved: false, startX: event.clientX, startY: event.clientY, startScroll: event.currentTarget.scrollLeft }
      }}
      onPointerMove={(event) => {
        if (!drag.current.active) return
        const distanceX = event.clientX - drag.current.startX
        const distanceY = event.clientY - drag.current.startY
        if (!drag.current.moved) {
          if (Math.abs(distanceX) <= 10 || Math.abs(distanceX) <= Math.abs(distanceY)) return
          drag.current.moved = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        event.currentTarget.scrollLeft = drag.current.startScroll - distanceX
        event.preventDefault()
      }}
      onPointerUp={finishDrag}
      ref={viewport}
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <div aria-label={label} className="flex w-max min-w-full snap-x snap-proximity gap-2 px-5" role="listbox">
        {children}
      </div>
    </div>
  )
}

export function givingCustomDateLimits(now = new Date()) {
  const today = nzDate(now)
  const { year } = dateParts(today)
  return {
    min: addCalendarDays(today, 1),
    max: isoDate(year + 1, 6, 30),
  }
}

export function clampGivingCustomDate(
  value: string,
  change: Partial<{ year: number; month: number; day: number }>,
  now = new Date(),
) {
  const limits = givingCustomDateLimits(now)
  const current = dateParts(value)
  const min = dateParts(limits.min)
  const max = dateParts(limits.max)
  const year = Math.min(max.year, Math.max(min.year, change.year ?? current.year))
  const minimumMonth = year === min.year ? min.month : 1
  const maximumMonth = year === max.year ? max.month : 12
  const month = Math.min(maximumMonth, Math.max(minimumMonth, change.month ?? current.month))
  const day = Math.min(daysInMonth(year, month), Math.max(1, change.day ?? current.day))
  const candidate = isoDate(year, month, day)
  if (candidate < limits.min) return limits.min
  if (candidate > limits.max) return limits.max
  return candidate
}

export function isGivingStartDateValid(frequency: GivingFrequency, amountMinor: number, startDate: string, now = new Date()) {
  if (frequency === 'one-off') return false
  try {
    assertFixedRecurringPaymentInput({ consentStatus: 'Authorised', period: frequency, startDate, amountMinor, maximumAmountPaymentMinor: amountMinor, maximumAmountPeriodMinor: amountMinor }, now)
    return true
  } catch {
    return false
  }
}

export function givingDateOptions(frequency: GivingFrequency, amountMinor: number, now = new Date()) {
  const today = nzDate(now)
  const options = [
    { value: today, label: 'Today' },
    { value: addCalendarDays(today, 1), label: 'Tomorrow' },
    { value: upcomingWeekday(today, 5), label: 'This Friday' },
    { value: nextDayOfMonth(today, 20), label: 'The 20th' },
  ]
  return options
    .filter(({ value }, index) => options.findIndex((option) => option.value === value) === index)
    .filter(({ value }) => isGivingStartDateValid(frequency, amountMinor, value, now))
}

export function givingStartDateSummary(value: string, now = new Date()) {
  const today = nzDate(now)
  const shortcuts = [
    { value: today, label: 'today' },
    { value: addCalendarDays(today, 1), label: 'tomorrow' },
    { value: upcomingWeekday(today, 5), label: 'this Friday' },
    { value: nextDayOfMonth(today, 20), label: 'the 20th' },
  ]
  const shortcut = shortcuts.find((option) => option.value === value)
  if (shortcut) return shortcut.label
  const { year, month, day } = dateParts(value)
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function CustomDatePicker({ initialValue, now, onCancel, onContinue }: {
  initialValue: string | null
  now: Date
  onCancel: () => void
  onContinue: (date: string) => void
}) {
  const limits = useMemo(() => givingCustomDateLimits(now), [now])
  const [draftDate, setDraftDate] = useState(() => {
    if (initialValue && initialValue >= limits.min && initialValue <= limits.max) return initialValue
    return limits.min
  })
  const selected = dateParts(draftDate)
  const min = dateParts(limits.min)
  const max = dateParts(limits.max)
  const months = Array.from(
    { length: (selected.year === max.year ? max.month : 12) - (selected.year === min.year ? min.month : 1) + 1 },
    (_, index) => (selected.year === min.year ? min.month : 1) + index,
  )
  const years = Array.from({ length: max.year - min.year + 1 }, (_, index) => min.year + index)
  const firstAvailableDay = selected.year === min.year && selected.month === min.month ? min.day : 1
  const days = Array.from(
    { length: daysInMonth(selected.year, selected.month) - firstAvailableDay + 1 },
    (_, index) => firstAvailableDay + index,
  )
  const monthName = (month: number) => new Intl.DateTimeFormat('en-NZ', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, month - 1, 1)))
  const weekdayName = (day: number) => new Intl.DateTimeFormat('en-NZ', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(selected.year, selected.month - 1, day)))

  return (
    <div className="animate-[fade-in_180ms_ease-out_both] space-y-3 motion-reduce:animate-none">
      <HorizontalPickerRow label="Month">
        {months.map((month) => (
          <button
            aria-selected={selected.month === month}
            autoFocus={selected.month === month}
            className={`min-h-14 min-w-[10rem] snap-start rounded-full border bg-white px-6 text-xl font-semibold transition hover:border-rich-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red ${selected.month === month ? 'border-rich-red ring-2 ring-rich-red/20' : 'border-warm-grey'}`}
            key={month}
            onClick={() => setDraftDate(clampGivingCustomDate(draftDate, { month }, now))}
            role="option"
            type="button"
          >
            {monthName(month)}
          </button>
        ))}
      </HorizontalPickerRow>
      <HorizontalPickerRow label="Day">
        {days.map((day) => (
          <button
            aria-selected={selected.day === day}
            className={`min-h-14 min-w-[7rem] snap-start rounded-full border bg-white px-4 font-semibold transition hover:border-rich-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red ${selected.day === day ? 'border-rich-red ring-2 ring-rich-red/20' : 'border-warm-grey'}`}
            key={day}
            onClick={() => setDraftDate(clampGivingCustomDate(draftDate, { day }, now))}
            role="option"
            type="button"
          >
            <span className="block text-xl leading-none">{day}</span>
            <span className="mt-0.5 block text-xs leading-none">{weekdayName(day)}</span>
          </button>
        ))}
      </HorizontalPickerRow>
      <HorizontalPickerRow label="Year">
        {years.map((year) => (
          <button
            aria-selected={selected.year === year}
            className={`min-h-14 min-w-[13rem] snap-start rounded-full border bg-white px-6 text-xl font-semibold transition hover:border-rich-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red ${selected.year === year ? 'border-rich-red ring-2 ring-rich-red/20' : 'border-warm-grey'}`}
            key={year}
            onClick={() => setDraftDate(clampGivingCustomDate(draftDate, { year }, now))}
            role="option"
            type="button"
          >
            {year}
          </button>
        ))}
      </HorizontalPickerRow>
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <button aria-label="Cancel custom date" className="min-h-16 rounded-full bg-warm-grey/70 text-3xl font-semibold text-brand-black transition hover:bg-warm-grey/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red" onClick={onCancel} type="button">×</button>
        <button className="min-h-16 rounded-full bg-rich-red px-6 text-xl font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2" onClick={() => onContinue(draftDate)} type="button">Continue</button>
      </div>
    </div>
  )
}

export function StartingDateStep({ value, frequency, amountMinor, onSelect, onInvalid, onCustomOpenChange }: { value: string | null; frequency: GivingFrequency; amountMinor: number; onSelect: (date: string) => void; onInvalid: () => void; onCustomOpenChange?: (open: boolean) => void }) {
  const [now] = useState(() => new Date())
  const [customOpen, setCustomOpen] = useState(false)
  const choose = (date: string) => isGivingStartDateValid(frequency, amountMinor, date, now) ? onSelect(date) : onInvalid()

  if (customOpen) {
    return <CustomDatePicker initialValue={value} now={now} onCancel={() => { setCustomOpen(false); onCustomOpenChange?.(false) }} onContinue={choose} />
  }

  return (
    <div className="space-y-3">
      {givingDateOptions(frequency, amountMinor, now).map((option, index) => (
        <button autoFocus={index === 0} key={option.value} type="button" data-date={option.value} onClick={() => choose(option.value)} className={`min-h-14 w-full rounded-full border bg-white px-5 text-left font-semibold ${value === option.value ? 'border-rich-red ring-2 ring-rich-red/20' : 'border-warm-grey'}`}>{option.label}</button>
      ))}
      <button className="min-h-14 w-full rounded-full bg-warm-grey/70 px-5 text-left font-semibold text-brand-black transition-colors hover:bg-warm-grey/90" onClick={() => { setCustomOpen(true); onCustomOpenChange?.(true) }} type="button">Choose another date</button>
    </div>
  )
}
