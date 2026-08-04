import { getRegistrationHref, type PublicEvent } from '@/lib/events'

const labels = {
  open: 'Registration open',
  full: 'Event full',
  closed: 'Registration closed',
  'coming-soon': 'Registration coming soon',
} as const

export function EventStatus({ event, compact = false }: { event: PublicEvent; compact?: boolean }) {
  const status = event.registrationStatus
  if (!status) return null

  const isOpen = Boolean(getRegistrationHref(event))
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold ${
        compact ? 'text-xs uppercase tracking-[0.12em]' : 'text-sm'
      } ${isOpen ? 'text-rich-red' : 'text-mid-grey'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-rich-red' : 'bg-mid-grey/60'}`} />
      {labels[status]}
    </span>
  )
}
