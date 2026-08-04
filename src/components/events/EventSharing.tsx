import { FaCalendarPlus, FaEnvelope, FaFacebookF, FaTwitter } from 'react-icons/fa'

import { getCanonicalEventUrl } from '@/lib/event-sharing'
import type { PublicEvent } from '@/lib/events'

export function EventSharing({ event }: { event: PublicEvent }) {
  const url = getCanonicalEventUrl(event)
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(event.title)
  const linkClass =
    'flex h-11 w-11 items-center justify-center rounded-full bg-brand-black text-white transition-colors hover:bg-rich-red focus:outline-none focus:ring-4 focus:ring-light-red-2'

  const links = [
    {
      label: 'Share on Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: <FaFacebookF aria-hidden="true" />,
      external: true,
    },
    {
      label: 'Share on Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: <FaTwitter aria-hidden="true" />,
      external: true,
    },
    {
      label: 'Share by email',
      href: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`Find out more: ${url}`)}`,
      icon: <FaEnvelope aria-hidden="true" />,
      external: false,
    },
    {
      label: 'Add to calendar',
      href: `/events/${event.slug}/calendar.ics`,
      icon: <FaCalendarPlus aria-hidden="true" />,
      external: false,
    },
  ]

  return (
    <div className="mt-9 border-t border-warm-grey pt-7">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">Share</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            className={linkClass}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {link.icon}
          </a>
        ))}
      </div>
    </div>
  )
}
