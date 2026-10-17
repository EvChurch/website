import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentMemberImpersonation } from '@/auth/member-impersonation'
import { reimbursementActor, reimbursementPool } from '@/lib/reimbursements/runtime'
import { openReimbursements, memberOverview } from '@/lib/reimbursements/store'
import { reimbursementReportPath, reimbursementRoute, reimbursementViewPaths } from '@/lib/reimbursements/paths'
import { Reimbursements } from '@/components/members/Reimbursements'
import { MemberPortalChrome, memberConnectGroupHref } from '@/components/members/MemberPortalChrome'
import { getMemberPortalHomeForProfile } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reimbursements', robots: { index: false, follow: false } }
export default async function ReimbursementsPage({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<{ report?: string }> }) {
  const { path } = await params
  const route = reimbursementRoute(path)
  if (!route) notFound()
  const { report } = await searchParams
  if (!path?.length && report) redirect(reimbursementReportPath(report))
  const returnTo = route.reportId ? reimbursementReportPath(route.reportId) : reimbursementViewPaths[route.view]
  if (await getCurrentMemberImpersonation()) return <main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-3xl">Reimbursements</h1><p className="my-5">Reimbursements are unavailable while viewing another member’s account. Return to your own account to continue.</p><Link className="font-semibold text-rich-red underline" href="/members" rel="nofollow">Back to members</Link></main>
  const actor = await reimbursementActor()
  if (!actor) redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
  if (route.view === 'payments' && !actor.finance) redirect(reimbursementViewPaths.mine)
  const pool = await reimbursementPool()
  await openReimbursements(pool, actor.personId)
  const [data, home] = await Promise.all([
    memberOverview(pool, actor), getMemberPortalHomeForProfile({ personId: actor.personId, name: actor.name, email: actor.email, photoUrl: null }),
  ])
  return <MemberPortalChrome active="reimbursements" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
    <Reimbursements initialOverview={data} initialReportId={route.reportId} initialView={route.view} />
  </MemberPortalChrome>
}
