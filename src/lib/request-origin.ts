export type OriginRequest = {
  headers: Pick<Headers, 'get'>
  nextUrl: Pick<URL, 'origin'>
}

export function isSameOriginRequest(request: OriginRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'

  try {
    const expectedOrigin =
      process.env.NODE_ENV === 'production'
        ? process.env.RAILWAY_PUBLIC_DOMAIN
          ? new URL(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`).origin
          : null
        : request.nextUrl.origin

    return expectedOrigin !== null && new URL(origin).origin === expectedOrigin
  } catch {
    return false
  }
}
