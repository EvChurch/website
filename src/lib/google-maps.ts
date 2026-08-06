function getGoogleMapsQuery(mapUrl: string): string | null {
  try {
    const url = new URL(mapUrl)
    const isGoogleMapsHost =
      url.hostname === 'google.com' ||
      url.hostname === 'www.google.com' ||
      url.hostname === 'maps.google.com'
    const query = url.searchParams.get('q')?.trim()

    if (
      url.protocol === 'https:' &&
      isGoogleMapsHost &&
      (url.pathname === '/maps' || url.pathname.startsWith('/maps/')) &&
      query
    ) {
      return query
    }
  } catch {
    return null
  }

  return null
}

export function isGoogleMapsUrl(mapUrl: string): boolean {
  return getGoogleMapsQuery(mapUrl) !== null
}

export function getGoogleMapsEmbedUrl(mapUrl: string, address: string): string {
  const query = getGoogleMapsQuery(mapUrl) ?? address

  const embedUrl = new URL('https://www.google.com/maps')
  embedUrl.searchParams.set('q', query)
  embedUrl.searchParams.set('output', 'embed')
  return embedUrl.toString()
}
