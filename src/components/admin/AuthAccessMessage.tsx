import Link from 'next/link'

interface AuthAccessMessageProps {
  eyebrow: string
  title: string
  children: React.ReactNode
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
}

export function AuthAccessMessage({
  eyebrow,
  title,
  children,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: AuthAccessMessageProps) {
  return (
    <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-h2 text-brand-black" tabIndex={-1}>
          {title}
        </h1>
        <div className="mt-4 space-y-3 text-base leading-relaxed text-dark-grey">
          {children}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-rich-red px-6 py-3 font-semibold text-white transition hover:bg-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rich-red"
            href={primaryHref}
            rel="nofollow"
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-black px-6 py-3 font-semibold text-brand-black transition hover:bg-brand-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black"
              href={secondaryHref}
              rel="nofollow"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
