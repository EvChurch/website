import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentMemberImpersonation } from '@/auth/member-impersonation'
import { reimbursementActor, reimbursementPool } from '@/lib/reimbursements/runtime'
import { openReimbursements, memberOverview } from '@/lib/reimbursements/store'
import { Reimbursements } from '@/components/members/Reimbursements'
import { MemberPortalChrome, memberConnectGroupHref } from '@/components/members/MemberPortalChrome'
import { getMemberPortalHomeForProfile } from '@/lib/members/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reimbursements', robots: { index: false, follow: false } }
export default async function ReimbursementsPage({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const { report } = await searchParams
  if (await getCurrentMemberImpersonation()) return <main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-3xl">Reimbursements</h1><p className="my-5">Reimbursements are unavailable while viewing another member’s account. Return to your own account to continue.</p><Link className="font-semibold text-rich-red underline" href="/members" rel="nofollow">Back to members</Link></main>
  const actor = await reimbursementActor()
  if (!actor) redirect(`/auth/login?returnTo=${encodeURIComponent(`/members/reimbursements${report ? `?report=${encodeURIComponent(report)}` : ''}`)}`)
  const pool = await reimbursementPool()
  await openReimbursements(pool, actor.personId)
  const [data, home] = await Promise.all([
    memberOverview(pool, actor), getMemberPortalHomeForProfile({ personId: actor.personId, name: actor.name, email: actor.email, photoUrl: null }),
  ])
  return <MemberPortalChrome active="reimbursements" member={home.profile} canAccessLeaderResources={home.canAccessLeaderResources} connectGroupHref={memberConnectGroupHref(home.groups)}>
    <Reimbursements initialOverview={data} initialReportId={report} />
  </MemberPortalChrome>
}
