import { memberMediaNotFound, memberMediaResponse } from '@/auth/member-media-response'
import { fetchMemberRockAvatar } from '@/auth/member-rock-avatar'
import { getPublicLeaderResourceAsset } from '@/lib/members/leader-resource-sharing'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const asset = await getPublicLeaderResourceAsset(token, 'avatar')
  if (!asset || asset.kind !== 'avatar') return memberMediaNotFound()
  const avatar = await fetchMemberRockAvatar(`/GetAvatar.ashx?PhotoId=${asset.photoId}&Size=256`)
  return avatar ? memberMediaResponse(avatar.body, avatar.contentType, { 'Referrer-Policy': 'no-referrer' }) : memberMediaNotFound()
}
