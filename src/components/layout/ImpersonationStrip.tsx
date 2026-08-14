import type { Ref } from 'react'

import type { MemberImpersonationDisplay } from '@/auth/member-impersonation'

export function ImpersonationStrip({
  impersonation,
  stripRef,
}: {
  impersonation: MemberImpersonationDisplay
  stripRef?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={stripRef}
      data-member-impersonation-strip
      className="relative z-[52] flex min-h-11 items-center justify-center bg-rich-red px-4 py-2 text-center text-sm text-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>
          Impersonating <strong>{impersonation.name}</strong>
        </span>
        <form action="/member-impersonation/stop" method="post">
          <button
            type="submit"
            className="font-semibold text-white underline decoration-white/60 underline-offset-4 hover:text-warm-white focus-visible:outline-2 focus-visible:outline-white"
          >
            Return to my account
          </button>
        </form>
      </div>
    </div>
  )
}
