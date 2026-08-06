import { getCurrentMemberProfile } from '@/auth/member-session'
import { fetchMemberRockAvatar } from '@/auth/member-rock-avatar'

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

function noAvatarResponse() {
  return new Response(null, { status: 404, headers: privateHeaders })
}

export async function GET() {
  const profile = await getCurrentMemberProfile()
  if (!profile?.photoUrl) return noAvatarResponse()

  const avatar = await fetchMemberRockAvatar(profile.photoUrl)
  if (!avatar) return noAvatarResponse()

  return new Response(avatar.body, {
    headers: {
      ...privateHeaders,
      'Content-Type': avatar.contentType,
    },
  })
}
