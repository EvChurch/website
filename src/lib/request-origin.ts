export type OriginRequest = {
  headers: Pick<Headers, 'get'>
  nextUrl: Pick<URL, 'origin'>
}

function originFromUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.pathname === '/' && !url.search && !url.hash ? url.origin : null
  } catch {
    return null
  }
}

function developmentOrigins(request: OriginRequest): Set<string> {
  const origins = new Set([request.nextUrl.origin])
  for (const value of [process.env.APP_BASE_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    const origin = originFromUrl(value)
    if (origin) origins.add(origin)
  }
  for (const host of process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',') ?? []) {
    const trimmed = host.trim()
    if (!trimmed) continue
    const origin = originFromUrl(trimmed) ?? originFromUrl(`https://${trimmed}`)
    if (origin) origins.add(origin)
  }
  return origins
}

function productionOrigins(): Set<string> {
  const origins = new Set<string>()
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.add(new URL(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`).origin)
  }
  for (const value of [process.env.APP_BASE_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    const origin = originFromUrl(value)
    if (origin) origins.add(origin)
  }
  return origins
}

export function isSameOriginRequest(request: OriginRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'

  try {
    const requestOrigin = new URL(origin).origin
    if (process.env.NODE_ENV !== 'production') return developmentOrigins(request).has(requestOrigin)
    return productionOrigins().has(requestOrigin)
  } catch {
    return false
  }
}
