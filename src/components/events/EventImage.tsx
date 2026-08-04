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
      className={`absolute inset-0 flex items-end overflow-hidden bg-[#1d1d1d] ${className}`}
      role="img"
      aria-label={`${event.title} event artwork`}
    >
      <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-rich-red/85 blur-[70px]" />
      <div className="absolute -bottom-36 left-[12%] h-80 w-[70%] rounded-full bg-deep-red/45 blur-[90px]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:24px_24px]" />
    </div>
  )
}
