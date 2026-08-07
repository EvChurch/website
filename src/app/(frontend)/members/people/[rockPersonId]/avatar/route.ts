import { memberMediaNotFound, memberMediaResponse } from '@/auth/member-media-response'
import { fetchMemberRockAvatar } from '@/auth/member-rock-avatar'
import { getSharedMemberAvatar } from '@/lib/members/data'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rockPersonId: string }> },
) {
  const { rockPersonId: rawRockPersonId } = await params
  const rockPersonId = Number(rawRockPersonId)
  const access = await getSharedMemberAvatar(rockPersonId)
  if (!access) return memberMediaNotFound()

  const avatar = await fetchMemberRockAvatar(
    `/GetAvatar.ashx?PhotoId=${access.photoId}&Size=256`,
  )
  return avatar
    ? memberMediaResponse(avatar.body, avatar.contentType)
    : memberMediaNotFound()
}
