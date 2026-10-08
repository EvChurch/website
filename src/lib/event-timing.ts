/** Shared by public pages and Rock sync; dates are stored as UTC instants. */
export interface EventTiming {
  startDate?: string | null
  endDate?: string | null
}

const aucklandDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function aucklandDate(value: string | Date): string {
  const parts = Object.fromEntries(
    aucklandDateFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function hasEventEnded(event: EventTiming, now = new Date()): boolean {
  if (event.endDate) return new Date(event.endDate).getTime() <= now.getTime()
  // An unknown finish time must not make an event disappear when it starts.
  return event.startDate ? aucklandDate(event.startDate) < aucklandDate(now) : false
}

export function isEventRunning(event: EventTiming, now = new Date()): boolean {
  if (!event.startDate) return false
  return new Date(event.startDate).getTime() <= now.getTime() && !hasEventEnded(event, now)
}
