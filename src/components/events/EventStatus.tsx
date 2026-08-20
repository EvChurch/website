import type { PublicEvent } from '@/lib/events'

const labels = {
  open: 'Registration open',
  full: 'Event full',
  closed: 'Registration closed',
  'coming-soon': 'Registration coming soon',
} as const

export function EventStatus({ event, onDark = false }: { event: PublicEvent; onDark?: boolean }) {
  const status = event.registrationStatus
  if (!status || status === 'open') return null

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-semibold ${
        onDark ? 'text-white/55' : 'text-brand-black'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${onDark ? 'bg-white/40' : 'bg-rich-red'}`} />
      {labels[status]}
    </span>
  )
}
