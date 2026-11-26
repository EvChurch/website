'use server'
import { redirect } from 'next/navigation'
import { getCurrentCourseIdentity } from '@/auth/course-session'
import { startCourseGroup, inviteToCourseGroup, acceptCourseInvitation, manageCourseGroup } from '@/lib/courses/groups'

async function identity() {
  const current = await getCurrentCourseIdentity()
  if (!current) redirect('/auth/login?returnTo=%2Fmembers%2Fcourses')
  return current
}
export async function startGroupAction(form: FormData) {
  const slug = String(form.get('slug') ?? '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid course.')
  const current = await getCurrentCourseIdentity()
  if (!current) redirect(`/auth/login?returnTo=${encodeURIComponent(`/members/courses/${slug}`)}`)
  const id = await startCourseGroup(current, slug, String(form.get('name') ?? ''))
  redirect(`/members/courses/groups/${id}`)
}
export async function inviteCourseAction(form: FormData) {
  const groupId = Number(form.get('groupId'))
  const current = await identity()
  let notice = 'invited'
  try { const result = await inviteToCourseGroup(current, groupId, String(form.get('email') ?? '')); if (!result.delivered) notice = 'delivery-unknown' }
  catch { notice = 'invite-unavailable' }
  redirect(`/members/courses/groups/${groupId}?notice=${notice}`)
}
export async function acceptCourseAction(form: FormData) {
  const token = String(form.get('token') ?? '')
  const current = await getCurrentCourseIdentity()
  if (!current) redirect(`/auth/login?returnTo=${encodeURIComponent(`/members/courses/invitations/${token}`)}`)
  let groupId: number
  try { groupId = await acceptCourseInvitation(current, token) }
  catch { redirect(`/members/courses/invitations/${encodeURIComponent(token)}`) }
  redirect(`/members/courses/groups/${groupId}`)
}
export async function manageCourseGroupAction(form: FormData) {
  const groupId = Number(form.get('groupId')), action = String(form.get('action') ?? '')
  if (!['leave','remove','transfer','close','delete-workbook','revoke'].includes(action)) throw new Error('Invalid action.')
  if (action === 'delete-workbook' && form.get('confirm') !== 'delete') throw new Error('Confirm deletion first.')
  try { await manageCourseGroup(await identity(), groupId, action as 'leave' | 'remove' | 'transfer' | 'close' | 'delete-workbook' | 'revoke', Number(form.get('targetId'))) }
  catch { redirect(`/members/courses/groups/${groupId}?notice=management-unavailable`) }
  redirect(action === 'leave' ? '/members/courses' : `/members/courses/groups/${groupId}`)
}
