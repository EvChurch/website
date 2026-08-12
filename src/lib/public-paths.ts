const EXCLUDED_PUBLIC_PREFIXES = [
  '/_next',
  '/admin',
  '/api',
  '/auth',
  '/member-auth',
  '/member-avatar',
  '/member-sign-in',
  '/members',
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

export const PUBLIC_PATH_HEADER = 'x-ev-public-path'

export function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
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

  return !EXCLUDED_PUBLIC_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix),
  )
}

export function parseInternalRedirectDestination(input: string): string | null {
  if (!input.startsWith('/') || input.startsWith('//')) return null
  if (input.includes('?') || input.includes('#')) return null
  return normalizePublicPath(input)
}
