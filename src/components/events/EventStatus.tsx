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
      } ${isOpen ? 'text-light-red-1' : 'text-white/55'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-light-red-1' : 'bg-white/40'}`} />
      {labels[status]}
    </span>
  )
}
