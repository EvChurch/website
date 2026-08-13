import { getCurrentMemberProfile } from '@/auth/member-session'
import { memberMediaNotFound, memberMediaResponse } from '@/auth/member-media-response'
import { fetchMemberRockAvatar } from '@/auth/member-rock-avatar'

export async function GET() {
  const profile = await getCurrentMemberProfile({ persistLegacyProfile: true })
  if (!profile?.photoUrl) return memberMediaNotFound('member-avatar')

  const avatar = await fetchMemberRockAvatar(profile.photoUrl)
  return avatar
    ? memberMediaResponse(avatar.body, avatar.contentType)
    : memberMediaNotFound('member-avatar')
}
