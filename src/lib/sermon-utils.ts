/**
 * Extract the audio URL from a sermon's `audio` field.
 * At depth 0, `audio` is a number (ID). At depth 1+, it's the full upload object with `url`.
 */
export function getSermonAudioUrl(
  audio: unknown,
): string {
  if (!audio) return ''
  if (typeof audio === 'object' && audio !== null && 'url' in audio) {
    return (audio as { url: string }).url ?? ''
  }
  return ''
}

/**
 * Check whether a sermon has at least one video with a YouTube ID.
 */
export function sermonHasVideo(sermon: { videos?: unknown }): boolean {
  if (!Array.isArray(sermon.videos)) return false
  return sermon.videos.some(
    (v) => typeof v === 'object' && v !== null && 'youtubeVideoId' in v && !!(v as Record<string, unknown>).youtubeVideoId,
  )
}

/**
 * Extract video options from a populated sermon for use in play button dropdowns.
 */
export function getSermonVideos(sermon: { videos?: unknown }): {
  campusName: string
  campusSlug: string
  youtubeVideoId: string
  startSeconds?: number
  endSeconds?: number
}[] {
  if (!Array.isArray(sermon.videos)) return []
  return sermon.videos
    .map((v) => {
      if (typeof v !== 'object' || v === null) return null
      const vid = v as Record<string, unknown>
      const campus = vid.campus
      const campusName =
        typeof campus === 'object' && campus !== null && 'name' in campus
          ? (campus as { name: string }).name
          : 'Video'
      const campusSlug =
        typeof campus === 'object' && campus !== null && 'slug' in campus
          ? (campus as { slug: string }).slug
          : 'default'
      const youtubeVideoId = vid.youtubeVideoId as string | undefined
      if (!youtubeVideoId) return null
      return {
        campusName,
        campusSlug,
        youtubeVideoId,
        startSeconds: (vid.sermonStartSeconds as number) ?? undefined,
        endSeconds: (vid.sermonEndSeconds as number) ?? undefined,
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
}

/**
 * Extract the series banner image URL from a populated sermon.
 * Requires depth 2 (sermon -> series -> bannerImage).
 */
export function getSeriesBannerUrl(sermon: { series?: unknown }): string | null {
  const series = Array.isArray(sermon.series) ? sermon.series[0] : null
  if (!series || typeof series !== 'object') return null
  const s = series as Record<string, unknown>
  const banner = s.bannerImage
  if (banner && typeof banner === 'object' && banner !== null && 'url' in banner) {
    return (banner as { url: string }).url
  }
  return null
}
