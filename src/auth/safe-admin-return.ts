const unsafeEncodedPath = /%(?:2f|5c)/i

export function safeAdminReturnTo(value: string | null | undefined) {
  if (!value || unsafeEncodedPath.test(value) || value.includes('\\')) return '/admin'

  try {
    const parsed = new URL(value, 'https://admin-return.invalid')
    if (parsed.origin !== 'https://admin-return.invalid') return '/admin'
    if (parsed.pathname !== '/admin' && !parsed.pathname.startsWith('/admin/')) {
      return '/admin'
    }
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return '/admin'
  }
}
