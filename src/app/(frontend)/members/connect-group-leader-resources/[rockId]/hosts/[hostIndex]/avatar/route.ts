import { memberMediaNotFound, memberMediaResponse } from '@/auth/member-media-response'
import { fetchMemberRockAvatar } from '@/auth/member-rock-avatar'
import { getMemberResourceAsset } from '@/lib/members/data'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rockId: string; hostIndex: string }> },
) {
  const { rockId: rawRockId, hostIndex: rawHostIndex } = await params
  const asset = await getMemberResourceAsset(Number(rawRockId), {
    kind: 'host-avatar',
    index: Number(rawHostIndex),
  })
  if (!asset || asset.kind !== 'avatar') {
    return memberMediaNotFound('members', 'connect-group-leader-resources', rawRockId, 'hosts', rawHostIndex, 'avatar')
  }
  const image = await fetchMemberRockAvatar(`/GetAvatar.ashx?PhotoId=${asset.photoId}&Size=160`)
  return image
    ? memberMediaResponse(image.body, image.contentType)
    : memberMediaNotFound('members', 'connect-group-leader-resources', rawRockId, 'hosts', rawHostIndex, 'avatar')
}
