import Image from 'next/image'

import { getEventImage, type PublicEvent } from '@/lib/events'

interface EventImageProps {
  event: PublicEvent
  priority?: boolean
  sizes: string
  className?: string
}

export function EventImage({ event, priority = false, sizes, className = '' }: EventImageProps) {
  const image = getEventImage(event)

  if (image?.url) {
    return (
      <Image
        src={image.url}
        alt={image.alt || event.title}
        fill
        priority={priority}
        sizes={sizes}
        className={`object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`absolute inset-0 flex items-end overflow-hidden bg-brand-black ${className}`}
      role="img"
      aria-label={`${event.title} event artwork`}
    >
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-rich-red/80 blur-2xl" />
      <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-deep-red/70 blur-3xl" />
      <div className="relative p-6 text-xs font-bold uppercase tracking-[0.24em] text-white/70">
        Ev Church Event
      </div>
    </div>
  )
}
