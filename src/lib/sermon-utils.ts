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
