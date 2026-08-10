import type { SermonMedia } from '@/components/media/MediaPlayerProvider'

import type { MemberLeaderResource } from './data'
import { youtubeVideoId } from './youtube'

export const LEADER_RESOURCE_VIDEO_SLUG = 'resource-video'

export function leaderResourceMedia(
  resource: MemberLeaderResource,
): SermonMedia | null {
  const videoId = youtubeVideoId(resource.youtubeUrl)
  if (!videoId) return null

  const identity = `connect-group-resource-${resource.rockId}`

  return {
    id: identity,
    slug: identity,
    title: resource.title,
    href: `/members/connect-group-leader-resources/${resource.rockId}`,
    access: 'members',
    audioUrl: '',
    speaker: resource.hosts.map((host) => host.name).join(' & ') || undefined,
    series: 'Connect Group Leader Resources',
    artworkUrl: resource.promotionalImageUrl ?? undefined,
    passageReference: resource.bibleReference ?? undefined,
    videos: [{
      campusName: 'Video',
      campusSlug: LEADER_RESOURCE_VIDEO_SLUG,
      youtubeVideoId: videoId,
    }],
  }
}
