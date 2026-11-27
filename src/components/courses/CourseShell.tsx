import type { ReactNode } from 'react'
import { MemberPortalNavigation } from '@/components/members/MemberPortalChrome'

/** Account-only shell: member links keep their own existing access checks. */
export function CourseShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-warm-white pb-20 pt-20 lg:pt-[100px]">
    <MemberPortalNavigation active="courses" />
    <div className="mx-auto max-w-[80rem] px-5 py-8 sm:px-8 sm:py-10">{children}</div>
  </div>
}
