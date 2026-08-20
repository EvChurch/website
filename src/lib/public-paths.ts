const ANALYTICS_SENSITIVE_PREFIXES = [
  '/admin',
  '/api',
  '/auth',
  '/contact',
  '/give',
  '/member-auth',
  '/member-avatar',
  '/member-sign-in',
  '/members',
  '/privacy',
  '/shared',
] as const

const METADATA_PATHS = new Set([
  '/apple-icon.png',
  '/favicon.ico',
  '/icon.png',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
])

const FILE_LIKE_SEGMENT = /(?:^|\/)[^/]+\.[A-Za-z0-9]{1,16}$/
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/
const ENCODED_STRUCTURAL_CHARACTER = /%(?:2e|2f|5c)/i
const LAUNCHER_TARGET = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const MAX_LAUNCHER_TARGET_LENGTH = 128
const INTERNAL_REDIRECT_ORIGIN = 'https://www.ev.church'

export const PUBLIC_PATH_HEADER = 'x-ev-public-path'

export function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isAnalyticsSensitivePath(pathname: string): boolean {
  return ANALYTICS_SENSITIVE_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix),
  )
}

function pathnameFromInput(input: string): string | null {
  if (!input || CONTROL_CHARACTER.test(input) || input.includes('\\')) return null

  if (/^https?:\/\//i.test(input)) {
    try {
      return new URL(input).pathname
    } catch {
      return null
    }
  }

  if (!input.startsWith('/') || input.startsWith('//')) return null
  return input.split(/[?#]/, 1)[0] ?? null
}

export function normalizePublicPath(input: string): string | null {
  const pathname = pathnameFromInput(input)
  if (
    !pathname ||
    pathname.includes('//') ||
    ENCODED_STRUCTURAL_CHARACTER.test(pathname)
  ) {
    return null
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }

  if (
    CONTROL_CHARACTER.test(decoded) ||
    decoded.includes('\\') ||
    decoded.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    return null
  }

  return decoded === '/' ? '/' : decoded.replace(/\/+$/, '')
}

export function isEligiblePublicPath(input: string): boolean {
  const pathname = normalizePublicPath(input)
  if (!pathname) return false
  if (METADATA_PATHS.has(pathname) || FILE_LIKE_SEGMENT.test(pathname)) return false

  return !matchesPathPrefix(pathname, '/_next') && !isAnalyticsSensitivePath(pathname)
}

export function isTrackableMissingPath(input: string): boolean {
  return normalizePublicPath(input) !== null
}

export function encodePublicPathHeader(input: string): string | null {
  const pathname = normalizePublicPath(input)
  return pathname ? encodeURIComponent(pathname) : null
}

export function decodePublicPathHeader(input: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(input)
  } catch {
    return null
  }
  return normalizePublicPath(decoded)
}

export function parseInternalRedirectDestination(input: string): string | null {
  if (
    !input.startsWith('/') ||
    input.startsWith('//') ||
    CONTROL_CHARACTER.test(input) ||
    input.includes('\\')
  ) {
    return null
  }
  if (input.includes('#')) return null

  let destination: URL
  try {
    destination = new URL(input, INTERNAL_REDIRECT_ORIGIN)
  } catch {
    return null
  }

  if (destination.origin !== INTERNAL_REDIRECT_ORIGIN) return null

  const pathname = normalizePublicPath(destination.pathname)
  if (!pathname) return null
  if (!destination.search) return pathname
  if (pathname !== '/') return null

  const entries = [...destination.searchParams.entries()]
  if (entries.length !== 1 || entries[0]?.[0] !== 'launcher') return null

  const target = entries[0][1]
  if (
    target.length > MAX_LAUNCHER_TARGET_LENGTH ||
    !LAUNCHER_TARGET.test(target)
  ) {
    return null
  }

  return `/?launcher=${encodeURIComponent(target)}`
}
