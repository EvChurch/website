const unsafeEncodedPath = /%(?:2f|5c)/i

const privatePathPrefixes = ['/admin', '/api', '/auth', '/member-auth'] as const
const givingResumePath = /^\/give\/resume\/[A-Za-z0-9_-]{43}$/u

export function safeMemberReturnTo(value: string | null | undefined) {
  if (
    !value?.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    unsafeEncodedPath.test(value)
  ) {
    return '/'
  }

  try {
    const parsed = new URL(value, 'https://member-return.invalid')
    if (parsed.origin !== 'https://member-return.invalid') return '/'
    if (
      privatePathPrefixes.some(
        (prefix) =>
          parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
      )
    ) {
      return '/'
    }
    if (parsed.pathname === '/give' || parsed.pathname.startsWith('/give/')) {
      return !parsed.search && !parsed.hash && givingResumePath.test(parsed.pathname)
        ? parsed.pathname
        : '/'
    }
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return '/'
  }
}
