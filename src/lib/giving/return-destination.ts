import { matchesPathPrefix } from '@/lib/public-paths'

const RETURN_TO_COOKIE = '__Host-ev_giving_return_to'
const MAX_RETURN_TO_LENGTH = 512

function withGivingReturn(url: URL) {
  url.searchParams.delete('launcher')
  url.searchParams.delete('giving')
  url.searchParams.set('giving', 'return')
  url.hash = ''
  return `${url.pathname}${url.search}`
}

export function givingReturnToCookieName() {
  return RETURN_TO_COOKIE
}

export function safeGivingReturnDestination(value: string | null | undefined, allowedOrigins: readonly string[]) {
  if (!value || value.length > MAX_RETURN_TO_LENGTH || /[\u0000-\u001f\u007f]/u.test(value)) return null
  let url: URL
  try {
    url = value.startsWith('/') && !value.startsWith('//')
      ? new URL(value, allowedOrigins[0] ?? 'https://www.ev.church')
      : new URL(value)
  } catch {
    return null
  }
  if (!allowedOrigins.includes(url.origin)) return null
  if (url.username || url.password || url.hash) return null
  if (matchesPathPrefix(url.pathname, '/api') || matchesPathPrefix(url.pathname, '/auth') || url.pathname === '/give/return') return null
  return withGivingReturn(url)
}

export function givingReturnDestinationFromRequest(request: Request) {
  const origin = request.headers.get('origin')
  const configured = process.env.APP_BASE_URL
  const requestOrigin = (() => {
    try { return new URL(request.url).origin } catch { return null }
  })()
  const allowedOrigins = [origin, configured, requestOrigin].filter((value): value is string => Boolean(value))
  return safeGivingReturnDestination(request.headers.get('referer'), allowedOrigins) ?? '/?giving=return'
}
