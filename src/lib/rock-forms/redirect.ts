const MAX_REDIRECT_LENGTH = 2_048
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

function isLocalDevelopmentOrigin(url: URL): boolean {
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]')
  )
}

function trustedHttpsOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>()
  for (const entry of value?.split(',') || []) {
    const candidate = entry.trim()
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash
      ) {
        origins.add(url.origin)
      }
    } catch {
      // Invalid configuration entries grant no trust.
    }
  }
  return origins
}

export function safeRockWorkflowRedirect(
  value: unknown,
  requestOrigin: string,
  trustedOriginList = process.env.ROCK_WORKFLOW_REDIRECT_ORIGINS,
): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_REDIRECT_LENGTH ||
    value !== value.trim() ||
    CONTROL_CHARACTERS.test(value) ||
    value.startsWith('//') ||
    value.startsWith('\\')
  ) {
    return null
  }

  let base: URL
  let destination: URL
  try {
    base = new URL(requestOrigin)
    destination = new URL(value, `${base.origin}/`)
  } catch {
    return null
  }

  if (
    base.origin === 'null' ||
    base.username ||
    base.password ||
    destination.username ||
    destination.password
  ) {
    return null
  }

  if (destination.origin === base.origin) {
    if (base.protocol !== 'https:' && !isLocalDevelopmentOrigin(base)) {
      return null
    }
    return destination.href
  }

  if (
    destination.protocol !== 'https:' ||
    !trustedHttpsOrigins(trustedOriginList).has(destination.origin)
  ) {
    return null
  }

  return destination.href
}
