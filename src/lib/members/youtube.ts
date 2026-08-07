const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const videoIdPattern = /^[A-Za-z0-9_-]{6,64}$/u

export function youtubeEmbedUrl(value: string | null): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null

    let videoId: string | null = null
    if (url.hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? null
    } else if (youtubeHosts.has(url.hostname)) {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v')
      if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/').filter(Boolean)[1] ?? null
      }
    }

    return videoId && videoIdPattern.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null
  } catch {
    return null
  }
}
