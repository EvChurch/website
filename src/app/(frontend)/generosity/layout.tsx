import type { ReactNode } from 'react'

export default function GenerosityLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <section aria-label="Ready to give" className="border-t border-warm-grey bg-warm-white px-5 py-10 text-center">
        <p className="text-lg font-semibold">
          Ready to give?{' '}
          <a href="https://give.ev.church" className="text-deep-red underline underline-offset-4">
            → give.ev.church
          </a>
        </p>
      </section>
    </>
  )
}
