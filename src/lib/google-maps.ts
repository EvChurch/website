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

export function getGoogleMapsEmbedUrl(
  mapUrl: string,
  address: string,
  apiKey?: string,
): string {
  const query = getGoogleMapsQuery(mapUrl)
  const placeIdQuery = query?.startsWith('place_id:') ? query : null
  const configuredApiKey = apiKey?.trim()

  if (placeIdQuery && configuredApiKey) {
    const embedUrl = new URL('https://www.google.com/maps/embed/v1/place')
    embedUrl.searchParams.set('key', configuredApiKey)
    embedUrl.searchParams.set('q', placeIdQuery)
    return embedUrl.toString()
  }

  const embedUrl = new URL('https://www.google.com/maps')
  embedUrl.searchParams.set('q', placeIdQuery ? address : (query ?? address))
  embedUrl.searchParams.set('output', 'embed')
  return embedUrl.toString()
}
