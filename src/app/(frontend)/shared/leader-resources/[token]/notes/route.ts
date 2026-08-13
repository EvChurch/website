import { memberMediaNotFound, memberMediaResponse, memberMediaUnavailable } from '@/auth/member-media-response'
import { fetchMemberRockFile, MemberRockFileUnavailableError } from '@/auth/member-rock-file'
import { getPublicLeaderResourceAsset } from '@/lib/members/leader-resource-sharing'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const asset = await getPublicLeaderResourceAsset(token, 'notes')
  if (!asset || asset.kind !== 'notes') return memberMediaNotFound()
  try {
    const file = await fetchMemberRockFile(asset.guid)
    return file ? memberMediaResponse(file.body, file.contentType, {
      'Content-Disposition': `inline; filename="${asset.name.replace(/[^A-Za-z0-9._ -]/gu, '').slice(0, 120) || 'leader-notes'}"`,
      'Referrer-Policy': 'no-referrer',
    }) : memberMediaNotFound()
  } catch (error) {
    if (!(error instanceof MemberRockFileUnavailableError)) throw error
    return memberMediaUnavailable()
  }
}
