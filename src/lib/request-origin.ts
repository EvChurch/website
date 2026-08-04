export type OriginRequest = {
  headers: Pick<Headers, 'get'>
  nextUrl: Pick<URL, 'origin'>
}

export function isSameOriginRequest(request: OriginRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'

  try {
    return new URL(origin).origin === request.nextUrl.origin
  } catch {
    return false
  }
}
