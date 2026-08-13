import {
  memberMediaNotFound,
  memberMediaResponse,
  memberMediaUnavailable,
} from '@/auth/member-media-response'
import {
  fetchMemberRockFile,
  MemberRockFileUnavailableError,
} from '@/auth/member-rock-file'
import { getMemberResourceAsset } from '@/lib/members/data'

function safeFilename(value: string) {
  const sanitized = value.replace(/[^A-Za-z0-9._ -]/gu, '').trim()
  return sanitized.slice(0, 120) || 'connect-group-resource'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rockId: string; kind: string }> },
) {
  const { rockId: rawRockId, kind } = await params
  if (kind !== 'leader-notes' && kind !== 'member-study') {
    return memberMediaNotFound('members', 'connect-group-leader-resources', rawRockId, 'files', kind)
  }
  const asset = await getMemberResourceAsset(Number(rawRockId), { kind })
  if (!asset || asset.kind !== 'file') {
    return memberMediaNotFound('members', 'connect-group-leader-resources', rawRockId, 'files', kind)
  }
  let file: Awaited<ReturnType<typeof fetchMemberRockFile>>
  try {
    file = await fetchMemberRockFile(asset.guid)
  } catch (error) {
    console.warn('Connect Group leader resource file fetch unavailable', {
      upstreamStatus: error instanceof MemberRockFileUnavailableError
        ? error.upstreamStatus
        : undefined,
    })
    return memberMediaUnavailable()
  }
  if (!file) {
    return memberMediaNotFound('members', 'connect-group-leader-resources', rawRockId, 'files', kind)
  }
  return memberMediaResponse(file.body, file.contentType, {
    'Content-Disposition': `attachment; filename="${safeFilename(asset.name)}"`,
  })
}
