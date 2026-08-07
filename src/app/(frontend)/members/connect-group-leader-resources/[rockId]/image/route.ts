import { memberMediaNotFound, memberMediaResponse } from '@/auth/member-media-response'
import { fetchMemberRockAvatar } from '@/auth/member-rock-avatar'
import { getMemberResourceAsset } from '@/lib/members/data'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rockId: string }> },
) {
  const { rockId: rawRockId } = await params
  const asset = await getMemberResourceAsset(Number(rawRockId), { kind: 'image' })
  if (!asset || asset.kind !== 'image') {
    return memberMediaNotFound()
  }
  const image = await fetchMemberRockAvatar(`/GetImage.ashx?Guid=${asset.guid}&w=1400`)
  return image
    ? memberMediaResponse(image.body, image.contentType)
    : memberMediaNotFound()
}
