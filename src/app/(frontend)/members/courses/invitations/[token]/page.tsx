import Link from 'next/link'
import { getCurrentCourseIdentity } from '@/auth/course-session'
import { getCourseInvitation } from '@/lib/courses/groups'
import { acceptCourseAction } from '../../group-actions'
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const identity = await getCurrentCourseIdentity()
  const invitation = identity ? await getCourseInvitation(identity, token) : null
  return <div className="mx-auto max-w-xl"><h1 className="text-4xl">Course invitation</h1>{!identity ? <Link className="mt-6 inline-block rounded-md bg-rich-red px-6 py-3 font-bold text-white" href={`/auth/login?returnTo=${encodeURIComponent(`/members/courses/invitations/${token}`)}`}>Sign in to join</Link> : invitation ? <><h2 className="mt-8 text-2xl">{invitation.title}</h2><p className="mt-3">Join {invitation.groupName}.</p><p className="mt-4 text-sm text-mid-grey">Shared answers are visible to this group, including people who join later. Personal answers stay private.</p><form action={acceptCourseAction} className="mt-6"><input type="hidden" name="token" value={token} /><button className="rounded-md bg-rich-red px-6 py-3 font-bold text-white">Join group →</button></form></> : <p className="mt-6">This invitation is unavailable. Use the invited email address, or ask for a new invitation.</p>}</div>
}
