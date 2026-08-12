import Link from 'next/link'
import Image from 'next/image'

import type { MemberLeaderResource } from '@/lib/members/data'

export function formatResourceDates(resource: MemberLeaderResource) {
  const start = resource.startDateTime ? new Date(resource.startDateTime) : null
  const end = resource.expireDateTime ? new Date(resource.expireDateTime) : null
  const format = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' })
  if (start && Number.isFinite(start.getTime()) && end && Number.isFinite(end.getTime())) {
    return `${format.format(start)} - ${format.format(end)}`
  }
  if (start && Number.isFinite(start.getTime())) return format.format(start)
  if (end && Number.isFinite(end.getTime())) return `Until ${format.format(end)}`
  return null
}

export function LeaderResourceCard({
  resource,
  featured = false,
}: {
  resource: MemberLeaderResource
  featured?: boolean
}) {
  const dates = formatResourceDates(resource)

  return (
    <Link
      href={`/members/connect-group-leader-resources/${resource.rockId}`}
      rel="nofollow"
      className={`group overflow-hidden rounded-2xl border border-warm-grey bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-black/5 focus:outline-none focus:ring-4 focus:ring-light-red-2 ${
        featured ? 'grid lg:grid-cols-[1.15fr_0.85fr]' : 'flex h-full flex-col'
      }`}
    >
      <div className={`relative overflow-hidden bg-[linear-gradient(135deg,#21080d,#0f0004)] ${featured ? 'min-h-72' : 'aspect-[16/9]'}`}>
        {resource.promotionalImageUrl ? (
          // Public, same-origin route so Next can optimize the artwork.
          <Image
            src={resource.promotionalImageUrl}
            alt=""
            fill
            sizes={featured ? '(min-width: 1024px) 45vw, 100vw' : '(min-width: 1024px) 33vw, 100vw'}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-end bg-[radial-gradient(circle_at_20%_20%,rgba(226,42,48,0.45),transparent_40%)] p-7">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Connect Groups</span>
          </div>
        )}
      </div>
      <div className={`flex flex-1 flex-col ${featured ? 'justify-center p-8 sm:p-10' : 'p-6'}`}>
        {dates && (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">{dates}</p>
        )}
        <h3 className={`${featured ? 'mt-4 text-4xl' : 'mt-3 text-2xl'} leading-tight text-brand-black`}>
          {resource.title}
        </h3>
        {resource.description && (
          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-mid-grey">
            {resource.description}
          </p>
        )}
        <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-rich-red">
          Open resource
          <svg aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
