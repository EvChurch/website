import Link from 'next/link'

interface ServiceTime {
  campus: string
  time: string
  href: string
  id?: string | null
}

interface ServiceTimesBlockProps {
  heading?: string | null
  services?: ServiceTime[] | null
}

export function ServiceTimesBlockComponent({
  heading = 'Join us this Sunday',
  services,
}: ServiceTimesBlockProps) {
  if (!services?.length) return null

  return (
    <section className="border-b border-brand-black/10 bg-warm-white text-brand-black">
      <div className="mx-auto flex max-w-[80rem] flex-col px-5 sm:flex-row sm:items-stretch lg:px-8">
        <div className="flex items-center border-b border-brand-black/10 py-4 sm:w-48 sm:shrink-0 sm:border-b-0 sm:border-r sm:py-5 sm:pr-6 lg:w-56">
          <h2 className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-rich-red">
            {heading}
          </h2>
        </div>

        <nav
          aria-label="Sunday service times"
          className="grid flex-1 grid-cols-1 divide-y divide-brand-black/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          {services.map((service) => (
            <Link
              key={service.id ?? `${service.campus}-${service.href}`}
              href={service.href}
              className="group flex min-h-16 items-center justify-between gap-3 py-3 transition-colors hover:text-rich-red focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-rich-red sm:px-5 sm:py-5 lg:px-7"
            >
              <span>
                <span className="block text-sm font-bold leading-tight">{service.campus}</span>
                <span className="mt-1 block text-xs text-dark-grey group-hover:text-rich-red/80">
                  Sunday · {service.time}
                </span>
              </span>
              <span aria-hidden="true" className="text-lg text-rich-red">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}
