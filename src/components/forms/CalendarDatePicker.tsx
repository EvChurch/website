'use client'

import { useState } from 'react'
import { HiCalendarDays, HiChevronLeft, HiChevronRight } from 'react-icons/hi2'

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

function currentDate() {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
  }).format(new Date())
}

export function CalendarDatePicker({
  endDate = '',
  id,
  isOpen,
  label,
  min,
  mode = 'single',
  onChange,
  onComplete,
  onOpen,
  placeholder = 'Date',
  required = false,
  startDate,
}: {
  endDate?: string
  id: string
  isOpen: boolean
  label: string
  min?: string
  mode?: 'single' | 'range'
  onChange: (startDate: string, endDate: string) => void
  onComplete: () => void
  onOpen: () => void
  placeholder?: string
  required?: boolean
  startDate: string
}) {
  const initial = startDate || min || currentDate()
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const { year, month } = dateParts(initial)
    return { year, month }
  })
  const minParts = min ? dateParts(min) : null
  const firstYear = minParts?.year ?? Math.min(1900, visibleMonth.year)
  const lastYear = Math.max(dateParts(currentDate()).year + 10, visibleMonth.year, firstYear)
  const daysInMonth = new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 0)).getUTCDate()
  const firstWeekday = (new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1)).getUTCDay() + 6) % 7
  const monthLabel = new Intl.DateTimeFormat('en-NZ', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1)))
  const canGoBack = !minParts || visibleMonth.year > minParts.year ||
    (visibleMonth.year === minParts.year && visibleMonth.month > minParts.month)

  function moveMonth(offset: number) {
    const date = new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1 + offset, 1))
    setVisibleMonth({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 })
  }

  function jumpToMonth(year: number, month: number) {
    setVisibleMonth(minParts && (year < minParts.year ||
      (year === minParts.year && month < minParts.month))
      ? { year: minParts.year, month: minParts.month }
      : { year, month })
  }

  function open() {
    const next = dateParts(startDate || min || currentDate())
    setVisibleMonth({ year: next.year, month: next.month })
    onOpen()
  }

  function choose(date: string) {
    if (mode === 'single') {
      onChange(date, '')
      onComplete()
      return
    }
    if (!startDate || endDate || date < startDate) {
      onChange(date, '')
      return
    }
    onChange(startDate, date)
    onComplete()
  }

  return (
    <div className="relative min-w-0 max-w-full">
      <button
        id={id}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={label}
        aria-required={required}
        onClick={open}
        className="flex min-h-12 w-full min-w-0 max-w-full items-center justify-between gap-3 rounded-lg border border-warm-grey bg-white px-4 py-3 text-left text-brand-black outline-none transition hover:border-rich-red/50 focus:border-rich-red focus:ring-2 focus:ring-rich-red/15"
      >
        {mode === 'range' ? (
          <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <span className={`min-w-0 truncate ${startDate ? '' : 'text-mid-grey'}`}>
              {startDate ? formatDate(startDate) : 'Start date'}
            </span>
            <span className="text-mid-grey">to</span>
            <span className={`min-w-0 truncate ${endDate ? '' : 'text-mid-grey'}`}>
              {endDate ? formatDate(endDate) : 'End date'}
            </span>
          </span>
        ) : (
          <span className={`min-w-0 flex-1 truncate ${startDate ? '' : 'text-mid-grey'}`}>
            {startDate ? formatDate(startDate) : placeholder}
          </span>
        )}
        <HiCalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-rich-red" />
      </button>
      {required && <input className="sr-only" value={startDate} required readOnly />}
      {isOpen && (
        <div
          role="dialog"
          aria-label={mode === 'range' ? 'Date range calendar' : `${label} calendar`}
          className="absolute left-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-4rem))] max-w-full rounded-xl border border-warm-grey bg-white p-4 shadow-xl"
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
            <p aria-live="polite" className="font-bold text-brand-black">{monthLabel}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-brand-black hover:bg-warm-white"
            >
              <HiChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              aria-label="Month"
              value={visibleMonth.month}
              onChange={(event) => jumpToMonth(visibleMonth.year, Number(event.target.value))}
              className="min-h-11 min-w-0 rounded-lg border border-warm-grey bg-white px-2 text-brand-black focus-visible:outline-2 focus-visible:outline-rich-red"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option
                  key={index}
                  value={index + 1}
                  disabled={Boolean(minParts && visibleMonth.year === minParts.year && index + 1 < minParts.month)}
                >
                  {new Intl.DateTimeFormat('en-NZ', { month: 'long', timeZone: 'UTC' })
                    .format(new Date(Date.UTC(2000, index, 1)))}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={visibleMonth.year}
              onChange={(event) => jumpToMonth(Number(event.target.value), visibleMonth.month)}
              className="min-h-11 min-w-0 rounded-lg border border-warm-grey bg-white px-2 text-brand-black focus-visible:outline-2 focus-visible:outline-rich-red"
            >
              {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => (
                <option key={firstYear + index} value={firstYear + index}>{firstYear + index}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-xs font-bold text-mid-grey" aria-hidden="true">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-2">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const date = isoDate(visibleMonth.year, visibleMonth.month, day)
              const disabled = Boolean(min && date < min)
              const rangeStart = date === startDate
              const rangeEnd = mode === 'range' && date === endDate
              const inRange = Boolean(mode === 'range' && startDate && endDate && date > startDate && date < endDate)
              const column = (firstWeekday + index) % 7
              const rangeColor = 'rgba(15, 0, 4, 0.06)'
              const rangeBackground = mode === 'single' || (rangeStart && rangeEnd)
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
