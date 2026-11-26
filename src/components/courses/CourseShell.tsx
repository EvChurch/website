import type { ReactNode } from 'react'
import Link from 'next/link'

/** Account-only shell: member links keep their own existing access checks. */
export function CourseShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-warm-white pb-20 pt-20 lg:pt-[100px]">
    <nav aria-label="Members" className="border-b border-warm-grey bg-white">
      <div className="mx-auto flex max-w-[80rem] gap-7 overflow-x-auto px-5 sm:px-8">
        <Link rel="nofollow" href="/members" className="shrink-0 py-5 text-sm font-bold">Overview</Link>
        <Link rel="nofollow" href="/members/courses" aria-current="page" className="shrink-0 border-b-4 border-rich-red py-5 text-sm font-bold text-rich-red">Courses</Link>
        <Link href="/help/take-a-course" className="shrink-0 py-5 text-sm font-bold">Help</Link>
      </div>
    </nav>
    <div className="mx-auto max-w-[80rem] px-5 py-8 sm:px-8 sm:py-10">{children}</div>
  </div>
}
