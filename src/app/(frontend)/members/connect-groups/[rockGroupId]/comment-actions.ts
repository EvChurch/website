'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  createMemberGroupComment,
  deleteMemberGroupComment,
  updateMemberGroupComment,
} from '@/lib/members/data'

export async function addConnectGroupCommentAction(rockGroupId: number, formData: FormData) {
  const result = await createMemberGroupComment(rockGroupId, {
    body: String(formData.get('body') ?? ''),
    coachesOnly: formData.get('coachesOnly') === 'on',
  })
  const path = `/members/connect-groups/${rockGroupId}/coaching`
  if (!result.ok) redirect(`${path}?comment=error`)
  revalidatePath(path)
  redirect(`${path}?comment=added`)
}

export async function updateConnectGroupCommentAction(
  rockGroupId: number,
  commentId: number | string,
  formData: FormData,
) {
  const result = await updateMemberGroupComment(rockGroupId, Number(commentId), {
    body: String(formData.get('body') ?? ''),
  })
  const path = `/members/connect-groups/${rockGroupId}/coaching`
  if (!result.ok) redirect(`${path}?comment=error`)
  revalidatePath(path)
  redirect(`${path}?comment=updated`)
}

export async function deleteConnectGroupCommentAction(
  rockGroupId: number,
  commentId: number | string,
) {
  const result = await deleteMemberGroupComment(rockGroupId, Number(commentId))
  const path = `/members/connect-groups/${rockGroupId}/coaching`
  if (!result.ok) redirect(`${path}?comment=error`)
  revalidatePath(path)
  redirect(`${path}?comment=deleted`)
}
